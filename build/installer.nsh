; PRD Writer — NSIS 自定义安装脚本
; 用于在安装/卸载时管理右键"新建"菜单

!macro customInstall
  ; === 右键"新建"菜单 ===
  ; 为 .prd 扩展名添加 ShellNew 条目
  WriteRegStr SHELL_CONTEXT "Software\Classes\.prd\ShellNew" "NullFile" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\.prd\ShellNew" "ItemName" "PRD Document"

  ; 刷新 Explorer 缓存，使右键菜单立即生效
  System::Call "shell32::SHChangeNotify(i,i,i,i) (0x08000000, 0x1000, 0, 0)"
!macroend

!macro customUnInstall
  ; 卸载时清理 ShellNew 条目
  DeleteRegKey SHELL_CONTEXT "Software\Classes\.prd\ShellNew"

  ; 刷新 Explorer 缓存
  System::Call "shell32::SHChangeNotify(i,i,i,i) (0x08000000, 0x1000, 0, 0)"
!macroend
