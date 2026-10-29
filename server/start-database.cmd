@echo off
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --basedir="C:\Program Files\MySQL\MySQL Server 8.0" --datadir="%~dp0mysql-data" --port=3307 --bind-address=127.0.0.1 --console
