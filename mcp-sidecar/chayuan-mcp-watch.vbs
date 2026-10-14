' ChayuanWpsMcp watchdog: run start-mcp.cmd fully hidden, do not wait.
' Registered as scheduled task ChayuanWpsMcpWatch (every 2 minutes);
' start-mcp.cmd exits fast (silent) when healthz already answers on 62588.
Set sh = CreateObject("WScript.Shell")
base = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.Run """" & base & "start-mcp.cmd""", 0, False
