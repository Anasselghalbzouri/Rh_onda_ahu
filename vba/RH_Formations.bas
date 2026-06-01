Attribute VB_Name = "RH_Formations"
' ============================================================
' RH_Formations.bas
' Module VBA - Synchronisation Formations avec l'API RH ONDA
' Dépendances : RH_Login.bas (RH_GetToken, EscapeJson, RH_ClearToken)
' ============================================================

Private Const API_BASE As String = "http://127.0.0.1:8000/api"
Private Const SHEET_SUIVI As String = "Suivi de Formation"

' ------------------------------------------------------------
' Push : lit toutes les feuilles "Programme*" et envoie
'        les formations vers POST /api/formations/bulk-sync
' ------------------------------------------------------------
Public Sub RH_SyncFormations_Push()
    Dim token As String
    token = RH_Login.RH_GetToken()
    If token = "" Then Exit Sub

    Dim wb As Workbook
    Set wb = ThisWorkbook

    Dim jsonRows As String
    jsonRows = ""
    Dim count As Integer
    count = 0

    Dim ws As Worksheet
    For Each ws In wb.Worksheets
        If InStr(ws.Name, "PRO de Formation") > 0 Then
            Dim lastRow As Long
            lastRow = ws.Cells(ws.Rows.count, 2).End(xlUp).Row

            Dim r As Long
            For r = 3 To lastRow
                Dim theme As String
                theme = Trim(ws.Cells(r, 2).Value)
                If theme = "" Then GoTo NextRow

                Dim organisme As String
                organisme = Trim(ws.Cells(r, 4).Value)

                Dim duree As String
                duree = Trim(ws.Cells(r, 5).Value)

                Dim observations As String
                observations = Trim(ws.Cells(r, 18).Value)

                ' Colonnes F(6) a Q(17) = mois 1 a 12
                Dim moisPrevu As Integer
                moisPrevu = 0
                Dim statut As String
                statut = "planifie"

                Dim m As Integer
                For m = 1 To 12
                    Dim cellVal As String
                    cellVal = Trim(ws.Cells(r, 5 + m).Value)
                    If cellVal = ChrW(9679) Or cellVal = Chr(149) Then
                        moisPrevu = m
                        statut = "realise"
                        Exit For
                    ElseIf LCase(cellVal) = "x" Then
                        moisPrevu = m
                        statut = "planifie"
                        Exit For
                    End If
                Next m

                Dim rowJson As String
                rowJson = "{"
                rowJson = rowJson & """intitule"":""" & RH_Login.EscapeJson(theme) & """"
                If organisme <> "" Then
                    rowJson = rowJson & ",""organisme"":""" & RH_Login.EscapeJson(organisme) & """"
                End If
                If duree <> "" And IsNumeric(duree) Then
                    rowJson = rowJson & ",""duree_jours"":" & CInt(duree)
                End If
                If moisPrevu > 0 Then
                    rowJson = rowJson & ",""mois_prevu"":" & moisPrevu
                End If
                rowJson = rowJson & ",""statut"":""" & statut & """"
                If observations <> "" Then
                    rowJson = rowJson & ",""observations"":""" & RH_Login.EscapeJson(observations) & """"
                End If
                rowJson = rowJson & "}"

                If jsonRows <> "" Then jsonRows = jsonRows & ","
                jsonRows = jsonRows & rowJson
                count = count + 1

NextRow:
            Next r
        End If
    Next ws

    If count = 0 Then
        MsgBox "Aucune formation trouvée dans les feuilles Programme.", vbInformation
        Exit Sub
    End If

    Dim payload As String
    payload = "{""formations"":[" & jsonRows & "]}"

    Dim resp As String
    resp = RH_PostJson(API_BASE & "/formations/bulk-sync", payload, token)

    If InStr(resp, "synced") > 0 Then
        MsgBox count & " formation(s) synchronisée(s) avec succès.", vbInformation
    Else
        MsgBox "Erreur lors de la synchronisation." & vbCrLf & resp, vbExclamation
    End If
End Sub

' ------------------------------------------------------------
' Pull : récupère les formations de l'année courante
'        et écrit dans la feuille "Suivi de Formation"
' ------------------------------------------------------------
Public Sub RH_SyncFormations_Pull()
    Dim token As String
    token = RH_Login.RH_GetToken()
    If token = "" Then Exit Sub

    Dim annee As String
    annee = CStr(Year(Now))

    Dim resp As String
    resp = RH_GetJson(API_BASE & "/formations?annee=" & annee, token)

    If resp = "" Then
        MsgBox "Aucune réponse de l'API.", vbExclamation
        Exit Sub
    End If

    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(SHEET_SUIVI)
    On Error GoTo 0

    If ws Is Nothing Then
        MsgBox "Feuille """ & SHEET_SUIVI & """ introuvable.", vbExclamation
        Exit Sub
    End If

    ' Effacer les données existantes (garder l'en-tête ligne 1)
    ws.Range("A2:F" & ws.Rows.count).ClearContents

    ' Parser le JSON — tableau "data" ou tableau direct
    Dim dataBlock As String
    Dim dataStart As Long
    dataStart = InStr(resp, """data"":[")
    If dataStart > 0 Then
        dataBlock = Mid(resp, dataStart + 8)
    Else
        dataBlock = resp
    End If

    Dim rowNum As Long
    rowNum = 2

    ' Extraction item par item
    Dim pos As Long
    pos = 1
    Do
        Dim objStart As Long
        objStart = InStr(pos, dataBlock, "{")
        If objStart = 0 Then Exit Do

        Dim objEnd As Long
        objEnd = RH_FindObjectEnd(dataBlock, objStart)
        If objEnd = 0 Then Exit Do

        Dim obj As String
        obj = Mid(dataBlock, objStart, objEnd - objStart + 1)

        Dim dateDeb As String
        dateDeb = RH_JsonValue(obj, "date_debut")

        Dim intitule As String
        intitule = RH_JsonValue(obj, "intitule")

        Dim organismeVal As String
        organismeVal = RH_JsonValue(obj, "organisme")

        Dim statutVal As String
        statutVal = RH_JsonValue(obj, "statut")

        Dim obsVal As String
        obsVal = RH_JsonValue(obj, "observations")

        Dim suiviVal As String
        If LCase(statutVal) = "realise" Or LCase(statutVal) = "terminee" Then
            suiviVal = "OUI"
        Else
            suiviVal = "NON"
        End If

        ws.Cells(rowNum, 1).Value = dateDeb
        ws.Cells(rowNum, 2).Value = intitule
        ws.Cells(rowNum, 3).Value = organismeVal
        ws.Cells(rowNum, 4).Value = statutVal
        ws.Cells(rowNum, 5).Value = suiviVal
        ws.Cells(rowNum, 6).Value = obsVal

        rowNum = rowNum + 1
        pos = objEnd + 1
    Loop

    MsgBox (rowNum - 2) & " formation(s) chargée(s) dans """ & SHEET_SUIVI & """.", vbInformation
End Sub

' ------------------------------------------------------------
' FilterByService : masque les lignes dont le service (col D)
'                  ne correspond pas à serviceNom
' ------------------------------------------------------------
Public Sub RH_FilterByService(serviceNom As String)
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(SHEET_SUIVI)
    On Error GoTo 0
    If ws Is Nothing Then Exit Sub

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.count, 1).End(xlUp).Row

    Dim i As Long
    For i = 2 To lastRow
        Dim cellService As String
        cellService = Trim(ws.Cells(i, 4).Value)
        If serviceNom = "" Then
            ws.Rows(i).Hidden = False
        Else
            ws.Rows(i).Hidden = (InStr(1, LCase(cellService), LCase(serviceNom)) = 0)
        End If
    Next i
End Sub

' ============================================================
' Fonctions internes HTTP
' ============================================================

Private Function RH_PostJson(url As String, payload As String, token As String) As String
    Dim http As Object
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")

    Dim bodyBytes() As Byte
    bodyBytes = RH_Login.Utf8Bytes(payload)

    http.Open "POST", url, False
    http.SetRequestHeader "Content-Type", "application/json; charset=utf-8"
    http.SetRequestHeader "Authorization", "Bearer " & token
    http.SetRequestHeader "Accept", "application/json"

    On Error GoTo HttpError
    http.Send bodyBytes

    If http.Status = 401 Then
        RH_Login.RH_ClearToken
        MsgBox "Session expirée. Veuillez vous reconnecter.", vbExclamation
        RH_PostJson = ""
        Exit Function
    End If

    RH_PostJson = http.ResponseText
    Exit Function
HttpError:
    RH_PostJson = ""
End Function

Private Function RH_GetJson(url As String, token As String) As String
    Dim http As Object
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")

    http.Open "GET", url, False
    http.SetRequestHeader "Authorization", "Bearer " & token
    http.SetRequestHeader "Accept", "application/json"

    On Error GoTo HttpError
    http.Send

    If http.Status = 401 Then
        RH_Login.RH_ClearToken
        MsgBox "Session expirée. Veuillez vous reconnecter.", vbExclamation
        RH_GetJson = ""
        Exit Function
    End If

    RH_GetJson = http.ResponseText
    Exit Function
HttpError:
    RH_GetJson = ""
End Function

' ------------------------------------------------------------
' RH_JsonValue : extrait la valeur d'une clé JSON string
' ------------------------------------------------------------
Private Function RH_JsonValue(json As String, key As String) As String
    Dim pattern As String
    pattern = """" & key & """:"
    Dim pos As Long
    pos = InStr(json, pattern)
    If pos = 0 Then
        RH_JsonValue = ""
        Exit Function
    End If

    pos = pos + Len(pattern)
    ' Sauter les espaces
    Do While Mid(json, pos, 1) = " "
        pos = pos + 1
    Loop

    If Mid(json, pos, 1) = """" Then
        ' Valeur string
        pos = pos + 1
        Dim endPos As Long
        endPos = InStr(pos, json, """")
        If endPos = 0 Then
            RH_JsonValue = ""
        Else
            RH_JsonValue = Mid(json, pos, endPos - pos)
        End If
    ElseIf Mid(json, pos, 4) = "null" Then
        RH_JsonValue = ""
    Else
        ' Valeur numérique ou booléen
        Dim endNum As Long
        endNum = pos
        Do While endNum <= Len(json)
            Dim c As String
            c = Mid(json, endNum, 1)
            If c = "," Or c = "}" Or c = "]" Then Exit Do
            endNum = endNum + 1
        Loop
        RH_JsonValue = Trim(Mid(json, pos, endNum - pos))
    End If
End Function

' ------------------------------------------------------------
' RH_FindObjectEnd : trouve la position de fermeture "}"
'                   en comptant les accolades imbriquées
' ------------------------------------------------------------
Private Function RH_FindObjectEnd(s As String, startPos As Long) As Long
    Dim depth As Integer
    depth = 0
    Dim i As Long
    Dim inString As Boolean
    inString = False

    For i = startPos To Len(s)
        Dim ch As String
        ch = Mid(s, i, 1)

        If inString Then
            If ch = "\" Then
                i = i + 1
            ElseIf ch = """" Then
                inString = False
            End If
        Else
            Select Case ch
                Case """"
                    inString = True
                Case "{"
                    depth = depth + 1
                Case "}"
                    depth = depth - 1
                    If depth = 0 Then
                        RH_FindObjectEnd = i
                        Exit Function
                    End If
            End Select
        End If
    Next i

    RH_FindObjectEnd = 0
End Function
