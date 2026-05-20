Attribute VB_Name = "RH_Login"
' ============================================================
' T-062 — Module de connexion à l'API RH-ONDA
' POST /api/login  →  stocke le Bearer token dans la feuille
' cachée "RH_Config" (cellule B1 = token, B2 = expiry hint)
' ============================================================
Option Explicit

Private Const API_URL       As String = "http://localhost:8000/api"
Private Const CONFIG_SHEET  As String = "RH_Config"
Private Const TOKEN_CELL    As String = "B1"
Private Const TOKEN_TS_CELL As String = "B2"   ' timestamp ISO de la dernière connexion

' ── Entrée publique ─────────────────────────────────────────
Public Function RH_GetToken() As String
    Dim token As String
    token = RH_ReadStoredToken()

    If token = "" Then
        ' Aucun token stocké → demander les identifiants
        token = RH_DoLogin()
    End If

    RH_GetToken = token
End Function

' ── Connexion interactive ────────────────────────────────────
Public Function RH_DoLogin() As String
    Dim matricule As String
    Dim motDePasse As String

    matricule  = InputBox("Matricule RH :", "Connexion à la plateforme RH-ONDA")
    If matricule = "" Then
        MsgBox "Connexion annulée.", vbExclamation
        RH_DoLogin = ""
        Exit Function
    End If

    motDePasse = InputBox("Mot de passe :", "Connexion à la plateforme RH-ONDA")
    If motDePasse = "" Then
        MsgBox "Connexion annulée.", vbExclamation
        RH_DoLogin = ""
        Exit Function
    End If

    Dim token As String
    token = RH_CallLogin(matricule, motDePasse)

    If token <> "" Then
        RH_StoreToken token
        MsgBox "Connexion réussie ✓", vbInformation, "RH-ONDA"
    End If

    RH_DoLogin = token
End Function

' ── Appel HTTP POST /api/login ───────────────────────────────
Private Function RH_CallLogin(matricule As String, motDePasse As String) As String
    Dim http    As Object
    Dim body    As String
    Dim resp    As String
    Dim token   As String

    On Error GoTo ErrHandler

    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.Open "POST", API_URL & "/login", False
    http.SetRequestHeader "Content-Type", "application/json"
    http.SetRequestHeader "Accept",       "application/json"

    ' Sérialisation JSON manuelle (pas de dépendance externe)
    body = "{""matricule"":""" & EscapeJson(matricule) & _
           """,""password"":""" & EscapeJson(motDePasse) & """}"

    http.Send Utf8Bytes(body)
    resp = http.ResponseText

    If http.Status = 200 Then
        token = JsonExtract(resp, "token")
        RH_CallLogin = token
    ElseIf http.Status = 422 Then
        Dim errMsg As String
        errMsg = JsonExtractFirstError(resp)
        MsgBox "Identifiants incorrects." & IIf(errMsg <> "", Chr(10) & errMsg, ""), _
               vbCritical, "RH-ONDA"
        RH_CallLogin = ""
    Else
        MsgBox "Erreur HTTP " & http.Status & " : " & http.StatusText, vbCritical, "RH-ONDA"
        RH_CallLogin = ""
    End If

    Set http = Nothing
    Exit Function

ErrHandler:
    MsgBox "Impossible de joindre l'API." & Chr(10) & _
           "Vérifiez que le serveur est démarré sur " & API_URL & Chr(10) & _
           "Erreur : " & Err.Description, vbCritical, "RH-ONDA"
    RH_CallLogin = ""
    If Not http Is Nothing Then Set http = Nothing
End Function

' ── Stockage du token dans la feuille cachée ─────────────────
Private Sub RH_StoreToken(token As String)
    Dim ws As Worksheet
    Set ws = RH_GetOrCreateConfigSheet()
    ws.Range(TOKEN_CELL).Value    = token
    ws.Range(TOKEN_TS_CELL).Value = Now()
End Sub

Private Function RH_ReadStoredToken() As String
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(CONFIG_SHEET)
    On Error GoTo 0
    If ws Is Nothing Then
        RH_ReadStoredToken = ""
        Exit Function
    End If
    RH_ReadStoredToken = CStr(ws.Range(TOKEN_CELL).Value)
End Function

' ── Réinitialiser le token (déconnexion locale) ──────────────
Public Sub RH_ClearToken()
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(CONFIG_SHEET)
    On Error GoTo 0
    If Not ws Is Nothing Then
        ws.Range(TOKEN_CELL).Value    = ""
        ws.Range(TOKEN_TS_CELL).Value = ""
    End If
    MsgBox "Token effacé. Vous serez invité à vous reconnecter lors du prochain envoi.", _
           vbInformation, "RH-ONDA"
End Sub

' ── Créer / récupérer la feuille de configuration ────────────
Private Function RH_GetOrCreateConfigSheet() As Worksheet
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(CONFIG_SHEET)
    On Error GoTo 0

    If ws Is Nothing Then
        Set ws = ThisWorkbook.Sheets.Add()
        ws.Name = CONFIG_SHEET

        ' Étiquettes
        ws.Range("A1").Value = "TOKEN"
        ws.Range("A2").Value = "CONNEXION"
        ws.Range("A3").Value = "API_URL"
        ws.Range("B3").Value = API_URL

        ws.Visible = xlSheetVeryHidden   ' caché même via l'interface Excel
    End If

    Set RH_GetOrCreateConfigSheet = ws
End Function

' ── Utilitaires JSON minimaux ────────────────────────────────
' Extrait la valeur d'une clé simple (string) dans un objet JSON plat
Private Function JsonExtract(json As String, key As String) As String
    Dim pattern As String
    Dim pos     As Long
    Dim endPos  As Long
    Dim val     As String

    pattern = """" & key & """:"
    pos = InStr(1, json, pattern, vbTextCompare)
    If pos = 0 Then
        JsonExtract = ""
        Exit Function
    End If

    pos = pos + Len(pattern)
    ' Sauter les espaces
    Do While Mid(json, pos, 1) = " "
        pos = pos + 1
    Loop

    If Mid(json, pos, 1) = """" Then
        ' Valeur entre guillemets
        pos = pos + 1
        endPos = InStr(pos, json, """")
        JsonExtract = Mid(json, pos, endPos - pos)
    Else
        ' Valeur numérique / booléenne / null
        endPos = pos
        Do While endPos <= Len(json) And InStr(",}]", Mid(json, endPos, 1)) = 0
            endPos = endPos + 1
        Loop
        JsonExtract = Trim(Mid(json, pos, endPos - pos))
    End If
End Function

' Extrait le premier message d'erreur dans errors.matricule[0] ou message
Private Function JsonExtractFirstError(json As String) As String
    Dim msg As String
    msg = JsonExtract(json, "message")
    If msg <> "" Then
        JsonExtractFirstError = msg
        Exit Function
    End If
    ' Chercher dans errors.matricule
    Dim pos As Long
    pos = InStr(1, json, """matricule"":[""", vbTextCompare)
    If pos > 0 Then
        pos = pos + Len("""matricule"":[""")
        Dim endPos As Long
        endPos = InStr(pos, json, """")
        JsonExtractFirstError = Mid(json, pos, endPos - pos)
    Else
        JsonExtractFirstError = ""
    End If
End Function

' Échappe les guillemets et antislashs pour injection JSON
Private Function EscapeJson(s As String) As String
    s = Replace(s, "\", "\\")
    s = Replace(s, """", "\""")
    EscapeJson = s
End Function

' Encode une chaîne VBA (UTF-16) en bytes UTF-8 via ADODB.Stream
' C'est la méthode fiable pour envoyer du JSON avec WinHttp
Public Function Utf8Bytes(s As String) As Variant
    Dim stream As Object
    Set stream = CreateObject("ADODB.Stream")
    With stream
        .Type    = 2          ' adTypeText
        .Charset = "utf-8"
        .Open
        .WriteText s
        .Position = 0
        .Type = 1             ' adTypeBinary
        .Position = 3         ' sauter le BOM UTF-8 (3 octets)
        Utf8Bytes = .Read
        .Close
    End With
    Set stream = Nothing
End Function
