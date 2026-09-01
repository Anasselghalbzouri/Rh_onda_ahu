Attribute VB_Name = "RH_Cours"
' ============================================================
' Synchronisation du catalogue de cours vers l'API RH-ONDA
' Cible la feuille "Liste des Cours" du classeur
' "Tableau de Suivi de Formation siège.xlsx" (mise en page réelle) :
'   Ligne 6 = en-têtes : C=Thème du cours | D=Description | E=Durée ("5j")
'   F = STATUT_SYNC (écrite par la macro)
'   Données à partir de la ligne 7.
' Dépendance : RH_Login.bas (RH_GetToken, RH_ClearToken, Utf8Bytes)
' POST /api/cours/bulk-sync
' ============================================================
Option Explicit

Private Const API_URL      As String = "http://localhost:8000/api"
Private Const SHEET_COURS  As String = "Liste des Cours"
Private Const HEADER_ROW   As Long = 6
Private Const DATA_START   As Long = 7
Private Const COL_THEME    As Long = 3  ' C
Private Const COL_DESC     As Long = 4  ' D
Private Const COL_DUREE    As Long = 5  ' E
Private Const COL_STATUT   As Long = 6  ' F

Public Sub RH_SyncCours()
    Dim token As String
    token = RH_Login.RH_GetToken()
    If token = "" Then Exit Sub

    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(SHEET_COURS)
    On Error GoTo 0
    If ws Is Nothing Then
        MsgBox "Feuille « " & SHEET_COURS & " » introuvable.", vbCritical, "RH-ONDA"
        Exit Sub
    End If

    ws.Cells(HEADER_ROW, COL_STATUT).Value = "STATUT_SYNC"

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, COL_THEME).End(xlUp).Row
    If lastRow < DATA_START Then
        MsgBox "Aucun cours à synchroniser.", vbInformation, "RH-ONDA"
        Exit Sub
    End If

    Dim jsonRows As String
    Dim rowCount As Long
    Dim r As Long
    Dim theme As String

    rowCount = 0
    For r = DATA_START To lastRow
        theme = Trim(CStr(ws.Cells(r, COL_THEME).Value))
        If theme <> "" Then
            If rowCount > 0 Then jsonRows = jsonRows & ","
            jsonRows = jsonRows & BuildCoursJson(ws, r)
            ws.Cells(r, COL_STATUT).Value = "En cours..."
            ws.Cells(r, COL_STATUT).Interior.Color = RGB(255, 249, 196)
            rowCount = rowCount + 1
        End If
    Next r

    If rowCount = 0 Then
        MsgBox "Aucune ligne avec un thème de cours renseigné.", vbInformation, "RH-ONDA"
        Exit Sub
    End If

    Dim body As String
    body = "{""cours"":[" & jsonRows & "]}"

    Dim resp As String, status As Long
    If Not RH_PostJson(API_URL & "/cours/bulk-sync", token, body, resp, status) Then Exit Sub

    If status = 200 Then
        For r = DATA_START To lastRow
            If Trim(CStr(ws.Cells(r, COL_THEME).Value)) <> "" Then
                ws.Cells(r, COL_STATUT).Value = "Sync OK " & Format(Now(), "dd/mm/yyyy hh:mm")
                ws.Cells(r, COL_STATUT).Interior.Color = RGB(220, 252, 231)
                ws.Cells(r, COL_STATUT).Font.Color = RGB(21, 128, 61)
            End If
        Next r
        MsgBox "Synchronisation terminée ✓" & Chr(10) & _
               "Créés : " & JsonExtract(resp, "created") & Chr(10) & _
               "Mis à jour : " & JsonExtract(resp, "updated"), vbInformation, "RH-ONDA"
    Else
        For r = DATA_START To lastRow
            If Trim(CStr(ws.Cells(r, COL_THEME).Value)) <> "" Then
                ws.Cells(r, COL_STATUT).Value = "Erreur"
                ws.Cells(r, COL_STATUT).Interior.Color = RGB(248, 215, 218)
            End If
        Next r
        MsgBox "Erreur API " & status & Chr(10) & resp, vbCritical, "RH-ONDA"
    End If
End Sub

Private Function BuildCoursJson(ws As Worksheet, r As Long) As String
    Dim j As String
    Dim description As String
    Dim duree As Long

    j = "{""theme"":""" & EscapeJson(Trim(CStr(ws.Cells(r, COL_THEME).Value))) & """"

    description = Trim(CStr(ws.Cells(r, COL_DESC).Value))
    If description <> "" Then
        j = j & ",""description"":""" & EscapeJson(description) & """"
    End If

    duree = ParseDureeJours(CStr(ws.Cells(r, COL_DUREE).Value))
    If duree > 0 Then j = j & ",""duree_jours"":" & duree

    BuildCoursJson = j & "}"
End Function

' "5j" -> 5 ; "2 jours" -> 2 ; "" -> 0
Private Function ParseDureeJours(raw As String) As Long
    Dim i As Long, digits As String, c As String
    For i = 1 To Len(raw)
        c = Mid(raw, i, 1)
        If c >= "0" And c <= "9" Then digits = digits & c
    Next i
    If digits <> "" Then ParseDureeJours = CLng(digits) Else ParseDureeJours = 0
End Function

Private Function RH_PostJson(url As String, token As String, body As String, _
                              ByRef respText As String, ByRef httpStatus As Long) As Boolean
    Dim http As Object
    On Error GoTo ErrHandler

    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.Open "POST", url, False
    http.SetRequestHeader "Content-Type", "application/json"
    http.SetRequestHeader "Accept", "application/json"
    http.SetRequestHeader "Authorization", "Bearer " & token

    http.Send RH_Login.Utf8Bytes(body)
    httpStatus = http.Status
    respText = http.ResponseText

    If httpStatus = 401 Then
        RH_Login.RH_ClearToken
        MsgBox "Session expirée. Veuillez vous reconnecter et relancer la sync.", vbExclamation, "RH-ONDA"
        RH_PostJson = False
        Exit Function
    End If

    RH_PostJson = True
    Set http = Nothing
    Exit Function

ErrHandler:
    MsgBox "Impossible de joindre l'API." & Chr(10) & _
           "Vérifiez que le serveur est démarré sur " & API_URL & Chr(10) & _
           "Erreur : " & Err.Description, vbCritical, "RH-ONDA"
    RH_PostJson = False
    If Not http Is Nothing Then Set http = Nothing
End Function

Private Function JsonExtract(json As String, key As String) As String
    Dim pattern As String, pos As Long, endPos As Long
    pattern = """" & key & """:"
    pos = InStr(1, json, pattern, vbTextCompare)
    If pos = 0 Then JsonExtract = "": Exit Function
    pos = pos + Len(pattern)
    Do While Mid(json, pos, 1) = " ": pos = pos + 1: Loop
    If Mid(json, pos, 1) = """" Then
        pos = pos + 1
        endPos = InStr(pos, json, """")
        JsonExtract = Mid(json, pos, endPos - pos)
    Else
        endPos = pos
        Do While endPos <= Len(json) And InStr(",}]", Mid(json, endPos, 1)) = 0
            endPos = endPos + 1
        Loop
        JsonExtract = Trim(Mid(json, pos, endPos - pos))
    End If
End Function

Private Function EscapeJson(s As String) As String
    s = Replace(s, "\", "\\")
    s = Replace(s, """", "\""")
    EscapeJson = s
End Function
