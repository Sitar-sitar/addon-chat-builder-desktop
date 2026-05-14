@echo off
set "DOTNET_ROOT=C:\Program Files\dotnet"
set "DOTNET_MULTILEVEL_LOOKUP=0"
"%DOTNET_ROOT%\dotnet.exe" %*
