' Opens Sniper Journal, starting the server first if it is not already up.
' No console window appears either way.

Const URL = "http://127.0.0.1:3000/"

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))

Function ServerIsUp()
  Dim http
  ServerIsUp = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.XMLHTTP")
  http.Open "GET", URL, False
  http.Send
  If Err.Number = 0 Then ServerIsUp = True
  On Error GoTo 0
End Function

If Not ServerIsUp() Then
  sh.CurrentDirectory = root
  sh.Run "cmd /c npm run start", 0, False

  ' give it up to 40 seconds to come up, checking twice a second
  Dim i
  For i = 1 To 80
    WScript.Sleep 500
    If ServerIsUp() Then Exit For
  Next

  If Not ServerIsUp() Then
    MsgBox "Sniper Journal could not start." & vbCrLf & vbCrLf & _
           "Run INSTALLER.bat in the app folder to check what is wrong.", _
           vbExclamation, "Sniper Journal"
    WScript.Quit 1
  End If
End If

sh.Run URL, 1, False
