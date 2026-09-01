Attribute VB_Name = "RH_RapportActivite"
' ============================================================
' Génère automatiquement les indicateurs CALCULABLES du rapport
' PS09 "Rapport d'activité Trimestriel" à partir de la plateforme
' RH-ONDA, dans le classeur PS09_Rapport d'activité Trimestriel.xlsx.
'
' Ne remplit QUE ce qui a une source de données fiable :
'   - Table "Formation" (ligne d'en-tête contenant "Trimestre") :
'       Nbre de Formation Planifiées, Nbre de Formations Réalisées,
'       Nbre des Formations Evaluées, Nb des formations efficaces
'   - Table "Recrutement/Intégration/Départs/Muté" (en-tête "Année") :
'       Nbre d'effectif intégré, Nbre de départs, Nbre de mutation
'
' Tout le reste (accidents du travail, taux de polyvalence, actions
' d'amélioration, réclamations, besoins de recrutement, commentaires,
' texte libre...) reste à saisir manuellement comme aujourd'hui — ce
' ne sont pas des données suivies par la plateforme.
'
' Les colonnes formules (taux, %) ne sont jamais touchées : elles se
' recalculent automatiquement à partir des cellules remplies ici.
' Les 11 graphiques natifs du classeur lisent ces mêmes cellules et se
' mettent donc à jour automatiquement, sans jamais être reconstruits.
'
' Dépendance : RH_Login.bas (RH_GetToken, RH_ClearToken, Utf8Bytes)
' Cible la feuille ACTIVE (chaque trimestre a sa propre feuille dans ce
' classeur) — se placer sur la feuille du trimestre à mettre à jour
' avant de lancer la macro.
' GET /api/rapport-activite?annee=&trimestre=
' ============================================================
Option Explicit

Private Const API_URL As String = "http://localhost:8000/api"

Public Sub RH_GenerateRapport()
    Dim token As String
    token = RH_Login.RH_GetToken()
    If token = "" Then Exit Sub

    Dim ws As Worksheet
    Set ws = ActiveSheet

    Dim dateCell As Range
    Set dateCell = FindReportDate(ws)
    If dateCell Is Nothing Then
        MsgBox "Impossible de trouver la date du rapport (une date est attendue en ligne 5).", vbCritical, "RH-ONDA"
        Exit Sub
    End If

    Dim reportDate As Date
    reportDate = CDate(dateCell.Value)

    Dim annee As Integer, trimestre As Integer
    annee = Year(reportDate)
    trimestre = Int((Month(reportDate) - 1) / 3) + 1

    If MsgBox("Générer le rapport pour le trimestre " & trimestre & " / " & annee & _
              " (feuille active : " & ws.Name & ") ?", vbYesNo + vbQuestion, "RH-ONDA") = vbNo Then
        Exit Sub
    End If

    Dim url As String
    url = API_URL & "/rapport-activite?annee=" & annee & "&trimestre=" & trimestre

    Dim resp As String, status As Long
    If Not RH_GetJson(url, token, resp, status) Then Exit Sub

    If status <> 200 Then
        MsgBox "Erreur API (" & status & ") : " & resp, vbCritical, "RH-ONDA"
        Exit Sub
    End If

    Dim planifiees As String, realisees As String, evaluees As String, efficaces As String
    Dim integres As String, departs As String, mutations As String
    planifiees = JsonExtract(resp, "planifiees")
    realisees = JsonExtract(resp, "realisees")
    evaluees = JsonExtract(resp, "evaluees")
    efficaces = JsonExtract(resp, "efficaces")
    integres = JsonExtract(resp, "integres")
    departs = JsonExtract(resp, "departs")
    mutations = JsonExtract(resp, "mutations")

    Dim filled As Long
    filled = 0
    filled = filled + FillFormationTable(ws, planifiees, realisees, evaluees, efficaces)
    filled = filled + FillEffectifTable(ws, annee, integres, departs, mutations)

    If filled = 0 Then
        MsgBox "Aucun tableau reconnu sur cette feuille (en-têtes introuvables). " & _
               "Vérifiez que vous êtes bien sur une feuille du modèle PS09.", vbExclamation, "RH-ONDA"
    Else
        MsgBox "Rapport mis à jour (T" & trimestre & " " & annee & ") :" & Chr(10) & _
               "Formations planifiées/réalisées/évaluées/efficaces : " & planifiees & "/" & realisees & "/" & evaluees & "/" & efficaces & Chr(10) & _
               "Effectif intégré/départs/mutations (" & annee & ") : " & integres & "/" & departs & "/" & mutations & Chr(10) & Chr(10) & _
               "Les autres indicateurs (accidents, polyvalence, réclamations, " & _
               "actions d'amélioration...) restent à saisir manuellement.", vbInformation, "RH-ONDA"
    End If
End Sub

' ------------------------------------------------------------
' Localise la table Formation via son en-tête "Trimestre" et remplit
' la dernière ligne de données (= trimestre courant, structure en
' fenêtre glissante du modèle) avec les valeurs calculables.
' ------------------------------------------------------------
Private Function FillFormationTable(ws As Worksheet, planifiees As String, realisees As String, _
                                     evaluees As String, efficaces As String) As Long
    Dim hdrCell As Range
    Set hdrCell = ws.Cells.Find(What:="Trimestre", LookIn:=xlValues, LookAt:=xlPart)
    If hdrCell Is Nothing Then
        FillFormationTable = 0
        Exit Function
    End If

    Dim hdrRow As Long, labelCol As Long
    hdrRow = hdrCell.Row
    labelCol = hdrCell.Column

    Dim lastDataRow As Long
    lastDataRow = ws.Cells(ws.Rows.Count, labelCol).End(xlUp).Row
    If lastDataRow <= hdrRow Then
        FillFormationTable = 0
        Exit Function
    End If

    Dim colF As Long, colG As Long, colJ As Long, colM As Long
    colF = FindColInRow(ws, hdrRow, "Nbre de Formation Planifi")
    colG = FindColInRow(ws, hdrRow, "Nbre de Formations R")
    colJ = FindColInRow(ws, hdrRow, "Nbre des Formations Eval")
    colM = FindColInRow(ws, hdrRow, "formations efficaces")

    Dim n As Long
    n = 0
    If colF > 0 Then ws.Cells(lastDataRow, colF).Value = CLng(planifiees): n = n + 1
    If colG > 0 Then ws.Cells(lastDataRow, colG).Value = CLng(realisees): n = n + 1
    If colJ > 0 Then ws.Cells(lastDataRow, colJ).Value = CLng(evaluees): n = n + 1
    If colM > 0 Then ws.Cells(lastDataRow, colM).Value = CLng(efficaces): n = n + 1

    FillFormationTable = n
End Function

' ------------------------------------------------------------
' Localise la table Recrutement/Intégration/Départs/Muté via son
' en-tête "Nbre d'effectif intégré", trouve la ligne dont la colonne
' "Année" correspond à l'année demandée, et la remplit.
' ------------------------------------------------------------
Private Function FillEffectifTable(ws As Worksheet, annee As Integer, integres As String, _
                                    departs As String, mutations As String) As Long
    Dim hdrCell As Range
    Set hdrCell = ws.Cells.Find(What:="effectif int", LookIn:=xlValues, LookAt:=xlPart)
    If hdrCell Is Nothing Then
        FillEffectifTable = 0
        Exit Function
    End If

    Dim hdrRow As Long
    hdrRow = hdrCell.Row

    Dim yearCol As Long
    yearCol = FindColInRow(ws, hdrRow, "Ann")
    If yearCol = 0 Then
        FillEffectifTable = 0
        Exit Function
    End If

    Dim lastDataRow As Long
    lastDataRow = ws.Cells(ws.Rows.Count, yearCol).End(xlUp).Row

    Dim r As Long, targetRow As Long
    targetRow = 0
    For r = hdrRow + 1 To lastDataRow
        If CLng(ws.Cells(r, yearCol).Value) = annee Then
            targetRow = r
            Exit For
        End If
    Next r

    If targetRow = 0 Then
        FillEffectifTable = 0
        Exit Function
    End If

    Dim colIntegres As Long, colDeparts As Long, colMutations As Long
    colIntegres = hdrCell.Column
    colDeparts = FindColInRow(ws, hdrRow, "de d")
    colMutations = FindColInRow(ws, hdrRow, "mutation")

    Dim n As Long
    n = 0
    If colIntegres > 0 Then ws.Cells(targetRow, colIntegres).Value = CLng(integres): n = n + 1
    If colDeparts > 0 Then ws.Cells(targetRow, colDeparts).Value = CLng(departs): n = n + 1
    If colMutations > 0 Then ws.Cells(targetRow, colMutations).Value = CLng(mutations): n = n + 1

    FillEffectifTable = n
End Function

' Cherche une date (ligne 5, "date de fin de trimestre") — 1ère cellule
' de type date rencontrée dans les lignes 1 à 6.
Private Function FindReportDate(ws As Worksheet) As Range
    Dim r As Long, c As Long
    For r = 1 To 6
        For c = 1 To 24
            If IsDate(ws.Cells(r, c).Value) And ws.Cells(r, c).Value <> "" Then
                Set FindReportDate = ws.Cells(r, c)
                Exit Function
            End If
        Next c
    Next r
    Set FindReportDate = Nothing
End Function

' Cherche searchText (partiel) dans la ligne hdrRow, retourne la colonne (0 si absent).
Private Function FindColInRow(ws As Worksheet, hdrRow As Long, searchText As String) As Long
    Dim found As Range
    Set found = ws.Rows(hdrRow).Find(What:=searchText, LookIn:=xlValues, LookAt:=xlPart)
    If found Is Nothing Then
        FindColInRow = 0
    Else
        FindColInRow = found.Column
    End If
End Function

' ------------------------------------------------------------
' HTTP GET générique (voir RH_Formations.bas pour le même besoin côté formations)
' ------------------------------------------------------------
Private Function RH_GetJson(url As String, token As String, ByRef respText As String, ByRef httpStatus As Long) As Boolean
    Dim http As Object
    On Error GoTo ErrHandler

    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.Open "GET", url, False
    http.SetRequestHeader "Accept", "application/json"
    http.SetRequestHeader "Authorization", "Bearer " & token

    http.Send
    httpStatus = http.Status
    respText = http.ResponseText

    If httpStatus = 401 Then
        RH_Login.RH_ClearToken
        MsgBox "Session expirée. Veuillez vous reconnecter et relancer.", vbExclamation, "RH-ONDA"
        RH_GetJson = False
        Exit Function
    End If

    RH_GetJson = True
    Set http = Nothing
    Exit Function

ErrHandler:
    MsgBox "Impossible de joindre l'API." & Chr(10) & _
           "Vérifiez que le serveur est démarré sur " & API_URL & Chr(10) & _
           "Erreur : " & Err.Description, vbCritical, "RH-ONDA"
    RH_GetJson = False
    If Not http Is Nothing Then Set http = Nothing
End Function

Private Function JsonExtract(json As String, key As String) As String
    Dim pattern As String, pos As Long, endPos As Long
    pattern = """" & key & """:"
    pos = InStr(1, json, pattern, vbTextCompare)
    If pos = 0 Then JsonExtract = "0": Exit Function
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
