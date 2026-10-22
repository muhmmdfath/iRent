"""Check the generated handbook without accessing live application data."""
import argparse
import json
import re
from pathlib import Path

import pymupdf


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', action='store_true')
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    document_path = directory / 'iRent-Panduan-Lengkap-Admin.pdf'
    outline = json.loads((directory / 'manual-outline.json').read_text(encoding='utf-8'))
    source = (directory / 'panduan-admin.md').read_text(encoding='utf-8')
    document = pymupdf.open(document_path)
    assert len(document) == len(outline), 'Unexpected pagination'
    all_text = '\n'.join(page.get_text() for page in document)
    compact = lambda text: re.sub(r'\s+', ' ', text).strip()
    for page, expected in zip(document, outline):
        text = page.get_text()
        assert compact(expected['title']) in compact(text), f'Missing heading, page {page.number + 1}'
        assert f'{page.number + 1} / {len(document)}' in text, 'Missing page number'
        assert '\ufffd' not in text, 'Unexpected replacement glyph'
        assert len(text.strip()) > 80, 'Unexpected empty page'
        assert all(font[3].split('+')[-1].startswith('Poppins') for font in page.get_fonts()), 'Unexpected fallback font'
        for block in page.get_text('dict')['blocks']:
            if block['type'] != 0:
                continue
            for line in block['lines']:
                for span in line['spans']:
                    rect = pymupdf.Rect(span['bbox'])
                    assert rect.x0 >= -1 and rect.x1 <= page.rect.width + 1, 'Text outside page width'
                    assert rect.y0 >= -1 and rect.y1 <= page.rect.height + 1, 'Text outside page height'
    internal = [link for page in document for link in page.get_links() if link['kind'] in (pymupdf.LINK_GOTO, pymupdf.LINK_NAMED) and link.get('page', -1) >= 0]
    expected_destinations = set(range(4, len(document)))
    assert {link['page'] for link in internal} == expected_destinations, 'Missing or incorrect contents links'
    assert len(document.get_toc()) >= len(document), 'Missing document bookmarks'
    for required in ['Ganti password pelanggan', 'Koreksi receipt', 'Rekonsiliasi', 'Selesaikan persiapan', 'Catat transfer refund', 'Unduh Excel', 'Aktifkan notifikasi']:
        assert required in compact(all_text), f'Missing topic: {required}'
    if args.preview:
        target = directory.parents[1] / 'backend' / 'storage' / 'deployment' / 'manual-review'
        target.mkdir(parents=True, exist_ok=True)
        for number in [0, 2, 3, 8, 15, 18, 23, 31, 35, 39, 46]:
            document[number].get_pixmap(matrix=pymupdf.Matrix(1.2, 1.2)).save(target / f'page-{number + 1:02}.png')
        print(f'Preview: {target}')
    print(json.dumps({'pages': len(document), 'chapters': len(outline) - 4, 'source_words': len(source.split()), 'contents_links': len(internal), 'bookmarks': len(document.get_toc()), 'bytes': document_path.stat().st_size, 'result': 'PASS'}, indent=2))


if __name__ == '__main__':
    main()
