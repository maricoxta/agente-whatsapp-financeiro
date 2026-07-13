import sys
import json
import datetime

import pythoncom
import pywintypes
import win32com.client as win32

SHEET_NAME = '3 - Despesas'


def find_open_workbook(excel, path):
    for wb in excel.Workbooks:
        if wb.FullName.lower() == path.lower():
            return wb
    return None


def main():
    raw = sys.stdin.buffer.read().decode('utf-8')
    payload = json.loads(raw)
    path = payload['planilha']
    descricao = payload['descricao']
    valor = payload['valorPrevisto']
    dia, mes, ano = (int(x) for x in payload['dataVencimento'].split('/'))
    data_venc = pywintypes.Time(datetime.datetime(ano, mes, dia))

    pythoncom.CoInitialize()
    excel = None
    started_excel = False
    wb = None
    opened_wb = False
    try:
        try:
            excel = win32.GetActiveObject('Excel.Application')
        except Exception:
            excel = win32.gencache.EnsureDispatch('Excel.Application')
            excel.Visible = False
            started_excel = True

        excel.DisplayAlerts = False

        wb = find_open_workbook(excel, path)
        if wb is None:
            wb = excel.Workbooks.Open(path)
            opened_wb = True

        ws = wb.Worksheets(SHEET_NAME)

        row = 2
        while ws.Cells(row, 1).Value not in (None, ''):
            row += 1

        ws.Cells(row, 1).Value = descricao
        ws.Cells(row, 3).Value = valor
        cell_e = ws.Cells(row, 5)
        cell_e.Value = data_venc
        cell_e.NumberFormat = 'dd/mm/yyyy'

        wb.Save()
        print(json.dumps({'row': row}))
    except Exception as exc:
        print(json.dumps({'error': str(exc)}))
        sys.exit(1)
    finally:
        try:
            if wb is not None and opened_wb:
                wb.Close(SaveChanges=False)
            if started_excel and excel is not None:
                excel.Quit()
        except Exception:
            pass


if __name__ == '__main__':
    main()
