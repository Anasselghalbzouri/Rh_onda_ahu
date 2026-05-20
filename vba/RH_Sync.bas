Attribute VB_Name = "RH_Sync"
' ============================================================
' T-063 / T-064 — Synchronisation des employés vers l'API
' Lit les lignes de la feuille active (A→Q, ligne 2+)
' POST /api/employes/bulk-sync
' Écrit le résultat dans la colonne R (STATUT_SYNC)
' ============================================================
Option Explicit

Private Const API_URL       As String = "http://localhost:8000/api"
Private Const SYNC_SHEET    As String = "EMPLOYES"
Private Const DATA_START    As Long   = 2      ' première ligne de données
Private Const COL_MATRICULE As Long   = 1      ' A
Private Const COL_STATUS_R  As Long   = 18     ' R

' Colonnes A→Q (index → nom de champ API)
Private Function ColMap() As Variant
    ColMap = Array( _
        "matricule", "nom", "prenom", "sexe", _
        "date_naissance", "date_embauche", "categorie", "echelle", _
        "echelon", "entite", "fonction", "qualification", _
        "affectation", "date_affectation", "solde_conge", "statut", _
        "observation" _
    )
End Function

' ── Point d'entrée principal ─────────────────────────────────
Public Sub RH_SyncEmployes()
    Dim token As String
    token = RH_GetToken()
    If token = "" Then Exit Sub

    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(SYNC_SHEET)
    On Error GoTo 0
    If ws Is Nothing Then
        MsgBox "Feuille « " & SYNC_SHEET & " » introuvable.", vbCritical, "RH-ONDA"
        Exit Sub
    End If

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, COL_MATRICULE).End(xlUp).Row
    If lastRow < DATA_START Then
        MsgBox "Aucune donnée à synchroniser.", vbInformation, "RH-ONDA"
        Exit Sub
    End If

    ' ── Construire le JSON ───────────────────────────────────
    Dim fields()  As Variant
    fields = ColMap()
    Dim jsonRows  As String
    Dim rowCount  As Long
    rowCount = 0
    Dim r         As Long

    For r = DATA_START To lastRow
        Dim mat As String
        mat = Trim(CStr(ws.Cells(r, COL_MATRICULE).Value))
        If mat = "" Then GoTo NextRow

        Dim rowJson As String
        rowJson = BuildRowJson(ws, r, fields)
        If rowCount > 0 Then jsonRows = jsonRows & ","
        jsonRows = jsonRows & rowJson
        rowCount = rowCount + 1

NextRow:
    Next r

    If rowCount = 0 Then
        MsgBox "Aucune ligne avec matricule trouvée.", vbInformation, "RH-ONDA"
        Exit Sub
    End If

    Dim body As String
    body = "{""employes"":[" & jsonRows & "]}"

    ' ── Appel API ────────────────────────────────────────────
    Dim resp    As String
    Dim status  As Long
    If Not RH_PostJson(API_URL & "/employes/bulk-sync", token, body, resp, status) Then
        Exit Sub
    End If

    ' ── Écrire STATUT_SYNC (colonne R) ───────────────────────
    If status = 200 Then
        Dim nbCreated As String, nbUpdated As String, nbErrors As String
        nbCreated  = JsonExtract(resp, "created")
        nbUpdated  = JsonExtract(resp, "updated")
        nbErrors   = JsonExtract(resp, "errors")

        ' Marquer toutes les lignes envoyées avec "Sync OK"
        Dim syncMsg As String
        syncMsg = "Sync OK " & Format(Now(), "dd/mm/yyyy hh:mm")

        For r = DATA_START To lastRow
            mat = Trim(CStr(ws.Cells(r, COL_MATRICULE).Value))
            If mat <> "" Then
                ws.Cells(r, COL_STATUS_R).Value = syncMsg
                ws.Cells(r, COL_STATUS_R).Interior.Color = RGB(220, 252, 231)  ' vert clair
                ws.Cells(r, COL_STATUS_R).Font.Color      = RGB(21, 128, 61)
            End If
        Next r

        MsgBox "Synchronisation terminée ✓" & Chr(10) & _
               "Créés      : " & nbCreated & Chr(10) & _
               "Mis à jour : " & nbUpdated & Chr(10) & _
               "Erreurs    : " & nbErrors, vbInformation, "RH-ONDA"
    Else
        MsgBox "Erreur API " & status & Chr(10) & resp, vbCritical, "RH-ONDA"
    End If
End Sub

' ── Construire l'objet JSON d'une ligne ──────────────────────
Private Function BuildRowJson(ws As Worksheet, r As Long, fields() As Variant) As String
    Dim i       As Long
    Dim parts   As String
    Dim val     As String
    Dim rawVal  As Variant

    For i = 0 To UBound(fields)
        rawVal = ws.Cells(r, i + 1).Value    ' colonnes 1..17

        ' Conversion des dates Excel (Serial → ISO)
        If IsDate(rawVal) And Not IsEmpty(rawVal) Then
            val = Format(CDate(rawVal), "yyyy-mm-dd")
        ElseIf IsNumeric(rawVal) And Not IsEmpty(rawVal) Then
            val = CStr(rawVal)
        Else
            val = Trim(CStr(rawVal))
        End If

        ' Normaliser le champ statut (index 15 = colonne P)
        If i = 15 Then val = NormalizeStatut(val)

        If i > 0 Then parts = parts & ","
        parts = parts & """" & fields(i) & """:""" & EscapeJson(val) & """"
    Next i

    BuildRowJson = "{" & parts & "}"
End Function

' ── HTTP POST JSON générique ─────────────────────────────────
Private Function RH_PostJson(url As String, token As String, body As String, _
                              ByRef respText As String, ByRef httpStatus As Long) As Boolean
    Dim http As Object
    On Error GoTo ErrHandler

    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.Open "POST", url, False
    http.SetRequestHeader "Content-Type",  "application/json"
    http.SetRequestHeader "Accept",        "application/json"
    http.SetRequestHeader "Authorization", "Bearer " & token

    http.Send RH_Login.Utf8Bytes(body)
    httpStatus = http.Status
    respText   = http.ResponseText

    If httpStatus = 401 Then
        ' Token expiré → effacer et redemander
        RH_Login.RH_ClearToken
        MsgBox "Session expirée. Veuillez vous reconnecter et relancer la sync.", _
               vbExclamation, "RH-ONDA"
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

' ── Utilitaires (identiques à RH_Login) ─────────────────────
Private Function JsonExtract(json As String, key As String) As String
    Dim pattern As String
    Dim pos     As Long
    Dim endPos  As Long

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

' Normalise la valeur du champ statut vers les valeurs acceptées par l'API
Private Function NormalizeStatut(s As String) As String
    Dim v As String
    v = LCase(Trim(s))
    ' Supprimer les accents courants
    v = Replace(v, Chr(233), "e")  ' é
    v = Replace(v, Chr(234), "e")  ' ê
    v = Replace(v, Chr(232), "e")  ' è
    Select Case v
        Case "actif", "active":           NormalizeStatut = "actif"
        Case "mute", "mut", "mute":       NormalizeStatut = "mute"
        Case "retraite", "retraité":      NormalizeStatut = "retraite"
        Case "parti", "depart", "départ": NormalizeStatut = "parti"
        Case "suspendu":                  NormalizeStatut = "suspendu"
        Case Else:                        NormalizeStatut = ""  ' backend défaut = actif
    End Select
End Function
