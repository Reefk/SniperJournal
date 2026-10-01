' Starts the Sniper Journal server with no window at all.
' This is what Windows runs at startup, and what the desktop icon falls back
' to when the app is not already running.

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")

' assets\run-hidden.vbs -> the app folder is one level up
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
sh.CurrentDirectory = root

' 0 = no window, False = do not wait for it to finish
sh.Run "cmd /c npm run start", 0, False
