Attribute VB_Name = "RH_SuiviFormation"
' ============================================================
' Synchronisation de la feuille "Suivi de Formation" vers l'API
' RH-ONDA — classeur "Tableau de Suivi de Formation siège.xlsx"
' (mise en page réelle, distincte du fichier généré RH_Formations_ONDA.xlsx) :
'   Ligne 14 = en-têtes : C=Date de Formation | D=Collaborateurs | E=Cours |
'                          F=Service | G=Suivi (OUI/NON) | H=Remarque
'   I = STATUT_SYNC (écrite par la macro)
'   Données à partir de la ligne 15.
'
' Ce fichier n'a pas de matricule : le collaborateur est identifié par nom
' en texte libre. Le rapprochement avec les employés de la plateforme se
' fait CÔTÉ SERVEUR par correspondance de nom (best effort) — une ligne
' sans correspondance est marquée "Employe non trouve" (orange) mais la
' formation/le cours sont tout de même créés côté plateforme.
'
' Dépendance : RH_Login.bas (RH_GetToken, RH_ClearToken, Utf8Bytes)
' Lancer RH_Cours.RH_SyncCours au moins une fois avant (pas obligatoire :
' le cours est de toute façon créé au besoin par ce bulk-sync).
' POST /api/suivi-formation/bulk-sync
' ============================================================
Option Explicit

Private Const API_URL          As String = "http://localhost:8000/api"
Private Const SHEET_SUIVI      As String = "Suivi de Formation"
Private Const HEADER_ROW       As Long = 14
Private Const DATA_START       As Long = 15
Private Const COL_DATE         As Long = 3  ' C
Private Const COL_COLLAB       As Long = 4  ' D
Private Const COL_COURS        As Long = 5  ' E
Private Const COL_SERVICE      As Long = 6  ' F
Private Const COL_SUIVI        As Long = 7  ' G
Private Const COL_REMARQUE     As Long = 8  ' H
Private Const COL_STATUT       As Long = 9  ' I

Public Sub RH_SyncSuiviFormation()
    Dim token As String
    token = RH_Login.RH_GetToken()
    If token = "" Then Exit Sub

    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(SHEET_SUIVI)
    On Error GoTo 0
    If ws Is Nothing Then
        MsgBox "Feuille « " & SHEET_SUIVI & " » introuvable.", vbCritical, "RH-ONDA"
        Exit Sub
    End If

    ws.Cells(HEADER_ROW, COL_STATUT).Value = "STATUT_SYNC"

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, COL_COLLAB).End(xlUp).Row
    If lastRow < DATA_START Then
        MsgBox "Aucune ligne à synchroniser.", vbInformation, "RH-ONDA"
        Exit Sub
    End If

    Dim jsonRows As String
    Dim rowCount As Long
    Dim r As Long
    Dim collab As String

    rowCount = 0
    For r = DATA_START To lastRow
        collab = Trim(CStr(ws.Cells(r, COL_COLLAB).Value))
        If collab <> "" And Trim(CStr(ws.Cells(r, COL_COURS).Value)) <> "" Then
            If rowCount > 0 Then jsonRows = jsonRows & ","
            jsonRows = jsonRows & BuildSuiviJson(ws, r)
            ws.Cells(r, COL_STATUT).Value = "En cours..."
            ws.Cells(r, COL_STATUT).Interior.Color = RGB(255, 249, 196)
            rowCount = rowCount + 1
        End If
    Next r

    If rowCount = 0 Then
        MsgBox "Aucune ligne complète (collaborateur + cours) à synchroniser.", vbInformation, "RH-ONDA"
        Exit Sub
    End If

    Dim body As String
    body = "{""lignes"":[" & jsonRows & "]}"

    Dim resp As String, status As Long
    If Not RH_PostJson(API_URL & "/suivi-formation/bulk-sync", token, body, resp, status) Then Exit Sub

    If status = 200 Then
        WriteRowStatuses ws, lastRow, resp
        MsgBox "Synchronisation terminée ✓" & Chr(10) & _
               "Total : " & JsonExtract(resp, "total") & Chr(10) & _
               "Employés retrouvés : " & JsonExtract(resp, "employes_matched") & Chr(10) & _
               "Employés introuvables : " & JsonExtract(resp, "employes_introuvables") & Chr(10) & _
               "(corriger le nom pour les introuvables, puis relancer)", vbInformation, "RH-ONDA"
    Else
        For r = DATA_START To lastRow
            If Trim(CStr(ws.Cells(r, COL_COLLAB).Value)) <> "" Then
                ws.Cells(r, COL_STATUT).Value = "Erreur"
                ws.Cells(r, COL_STATUT).Interior.Color = RGB(248, 215, 218)
            End If
        Next r
        MsgBox "Erreur API " & status & Chr(10) & resp, vbCritical, "RH-ONDA"
    End If
End Sub

' Relit "results":[{...,"employe_status":"matched"|"introuvable"},...] dans l'ordre
' d'envoi et colore chaque ligne source en conséquence.
Private Sub WriteRowStatuses(ws As Worksheet, lastRow As Long, resp As String)
    Dim r As Long
    Dim searchPos As Long
    Dim objStart As Long, objEnd As Long
    Dim obj As String
    Dim empStatus As String

    searchPos = 1

    For r = DATA_START To lastRow
        If Trim(CStr(ws.Cells(r, COL_COLLAB).Value)) <> "" And Trim(CStr(ws.Cells(r, COL_COURS).Value)) <> "" Then
            objStart = InStr(searchPos, resp, "{")
            If objStart = 0 Then Exit For
            objEnd = FindObjectEnd(resp, objStart)
            If objEnd = 0 Then Exit For
            obj = Mid(resp, objStart, objEnd - objStart + 1)
            searchPos = objEnd + 1

            empStatus = JsonExtract(obj, "employe_status")
            If empStatus = "matched" Then
                ws.Cells(r, COL_STATUT).Value = "OK Synchro"
                ws.Cells(r, COL_STATUT).Interior.Color = RGB(220, 252, 231)
                ws.Cells(r, COL_STATUT).Font.Color = RGB(21, 128, 61)
            Else
                ws.Cells(r, COL_STATUT).Value = "Employe non trouve"
                ws.Cells(r, COL_STATUT).Interior.Color = RGB(255, 224, 178)
            End If
        End If
    Next r
End Sub

Private Function BuildSuiviJson(ws As Worksheet, r As Long) As String
    Dim j As String
    Dim dateDebut As String, dateFin As String
    Dim service As String, remarque As String
    Dim suiviOui As Boolean

    j = "{""collaborateur"":""" & EscapeJson(Trim(CStr(ws.Cells(r, COL_COLLAB).Value))) & """"
    j = j & ",""cours"":""" & EscapeJson(Trim(CStr(ws.Cells(r, COL_COURS).Value))) & """"

    ParseDateRange CStr(ws.Cells(r, COL_DATE).Value), dateDebut, dateFin
    If dateDebut <> "" Then j = j & ",""date_debut"":""" & dateDebut & """"
    If dateFin <> "" Then j = j & ",""date_fin"":""" & dateFin & """"

    service = Trim(CStr(ws.Cells(r, COL_SERVICE).Value))
    If service <> "" Then j = j & ",""service"":""" & EscapeJson(service) & """"

    suiviOui = (UCase(Trim(CStr(ws.Cells(r, COL_SUIVI).Value))) = "OUI")
    j = j & ",""suivi"":" & IIf(suiviOui, "true", "false")

    remarque = Trim(CStr(ws.Cells(r, COL_REMARQUE).Value))
    If remarque <> "" Then j = j & ",""remarque"":""" & EscapeJson(remarque) & """"

    BuildSuiviJson = j & "}"
End Function

' Extrait les 2 dates JJ/MM/AAAA d'un texte libre ("du X au Y" ou "au X du Y")
' et les classe (la plus ancienne = date_debut). Pas de dépendance regex :
' recherche manuelle des motifs \d{1,2}/\d{1,2}/\d{4}.
Private Sub ParseDateRange(raw As String, ByRef dateDebut As String, ByRef dateFin As String)
    Dim dates() As String
    Dim count As Long
    count = 0
    ReDim dates(1 To 2)

    Dim i As Long
    Dim tok As String
    tok = ""
    For i = 1 To Len(raw) + 1
        Dim c As String
        c = IIf(i <= Len(raw), Mid(raw, i, 1), " ")
        If (c >= "0" And c <= "9") Or c = "/" Then
            tok = tok & c
        Else
            If IsDateToken(tok) And count < 2 Then
                count = count + 1
                dates(count) = tok
            End If
            tok = ""
        End If
    Next i

    dateDebut = ""
    dateFin = ""
    If count = 0 Then Exit Sub

    Dim d1 As Date, d2 As Date
    d1 = TokenToDate(dates(1))
    If count >= 2 Then
        d2 = TokenToDate(dates(2))
    Else
        d2 = d1
    End If

    If d2 < d1 Then
        dateDebut = Format(d2, "yyyy-mm-dd")
        dateFin = Format(d1, "yyyy-mm-dd")
    Else
        dateDebut = Format(d1, "yyyy-mm-dd")
        dateFin = Format(d2, "yyyy-mm-dd")
    End If
End Sub

Private Function IsDateToken(tok As String) As Boolean
    IsDateToken = (tok Like "##/##/####") Or (tok Like "#/#/####") Or _
                  (tok Like "##/#/####") Or (tok Like "#/##/####")
End Function

Private Function TokenToDate(tok As String) As Date
    Dim parts() As String
    parts = Split(tok, "/")
    On Error GoTo Fail
    TokenToDate = DateSerial(CInt(parts(2)), CInt(parts(1)), CInt(parts(0)))
    Exit Function
Fail:
    TokenToDate = Date
End Function

Private Function FindObjectEnd(s As String, startPos As Long) As Long
    Dim depth As Long, i As Long, inString As Boolean, ch As String
    depth = 0
    inString = False
    For i = startPos To Len(s)
        ch = Mid(s, i, 1)
        If inString Then
            If ch = "\" Then
                i = i + 1
            ElseIf ch = """" Then
                inString = False
            End If
        Else
            Select Case ch
                Case """": inString = True
                Case "{": depth = depth + 1
                Case "}"
                    depth = depth - 1
                    If depth = 0 Then
                        FindObjectEnd = i
                        Exit Function
                    End If
            End Select
        End If
    Next i
    FindObjectEnd = 0
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
