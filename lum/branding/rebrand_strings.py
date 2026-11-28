#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lum: changes the name "Chromium" to "Lum" in all browser and installer strings, in every
language, and sets Lum's authors as the publisher/authors.

Why a script and not a patch: the strings live in .grd files (English) and .xtb files (81
translations). Translations are keyed by an id computed from the English text, so after the
text in a .grd changes the ids must be recomputed and replaced in every .xtb. A patch for that
would have thousands of lines and break on every Chromium update.

Run by build.py after the Lum patches (and by lum/devutils/rebuild.py).
Safe to run many times - a second run changes nothing.

What it does NOT change (on purpose):
- "ChromiumOS" / "Chromium OS" - the name of the OS, not of our browser,
- the link to the Chromium project on the "About" page ("... made possible by the Chromium
  open source project") - honest information about what Lum is built on (BSD license),
- descriptions (the desc attribute) - not visible to the user.

Usage: python3 rebrand_strings.py <build/src>
"""

import re
import sys
from pathlib import Path

PRODUCT = 'Lum'
# Lum's authors (publisher in the Windows app list, "About", copyright)
AUTHORS = {
    'en': 'Bartłomiej Kulesz and Oleh Nykorovych',
    'pl': 'Bartłomiej Kulesz i Oleh Nykorovych',
}
COPYRIGHT_XTB = {
    'en': 'Copyright <ph name="YEAR" /> {authors}. All rights reserved.',
    'pl': 'Copyright <ph name="YEAR" /> {authors}. Wszelkie prawa zastrzeżone.',
}

# String files that contain the product name (their .grdp parts are included automatically)
GRD_FILES = (
    'chrome/app/chromium_strings.grd',
    'components/components_chromium_strings.grd',
    'chrome/app/generated_resources.grd',
    'components/components_strings.grd',
)

_MESSAGE_RE = re.compile(r'(<message\b[^>]*>)(.*?)(</message>)', re.DOTALL)
_TRANSLATION_RE = re.compile(r'(<translation id=")(\d+)("[^>]*>)(.*?)(</translation>)', re.DOTALL)
# "Chromium" (also inflected: "Chromiumin", "Chromium을", Zulu "kuChromium"), but not:
# ChromiumOS, "Chromium OS", the link text to the Chromium project, "Chromium open source project",
# "The Chromium Projects" (an example page title)
_NAME_RE = re.compile(r'Chromium(?!\s*OS\b)(?!\s*<ph name="END_LINK_CHROMIUM")'
                      r'(?!\s+open[ -]source)(?!\s+Projects?\b)')
_ORIGINAL_AUTHORS = 'The Chromium Authors'


def _rebrand_text(text):
    return _NAME_RE.sub(PRODUCT, text.replace(_ORIGINAL_AUTHORS, AUTHORS['en']))


def _grd_parts(grd):
    """The .grd file plus every .grdp it includes (recursively)."""
    files = [grd]
    for part in re.findall(r'<part file="([^"]+)"', grd.read_text(encoding='utf-8')):
        files += _grd_parts(grd.parent / part)
    return files


def _xtb_files(grd):
    text = grd.read_text(encoding='utf-8')
    block = re.search(r'<translations>(.*?)</translations>', text, re.DOTALL)
    for path, lang in re.findall(r'<file path="([^"]+)" lang="([^"]+)"', block.group(1)):
        yield grd.parent / path, lang


def _message_ids(grd):
    """[(name, id, presentable text)] for every message, in document order."""
    from grit import grd_reader  # pylint: disable=import-outside-toplevel
    from grit.node import message  # pylint: disable=import-outside-toplevel
    root = grd_reader.Parse(str(grd), skip_validation_checks=True, translate_genders=True)
    result = []
    for node in root.Preorder():
        if isinstance(node, message.MessageNode):
            msg = node.GetCliques()[0].GetMessage()
            result.append((node.attrs['name'], msg.GetId(), msg.GetPresentableContent()))
    return result


def _rebrand_grd(grd):
    old = _message_ids(grd)
    changed_files = 0
    for path in _grd_parts(grd):
        text = path.read_text(encoding='utf-8')
        new_text = _MESSAGE_RE.sub(lambda m: m.group(1) + _rebrand_text(m.group(2)) + m.group(3), text)
        if new_text != text:
            path.write_text(new_text, encoding='utf-8', newline='')
            changed_files += 1
    new = _message_ids(grd)
    if [n for n, _, _ in old] != [n for n, _, _ in new]:
        raise RuntimeError(f'{grd}: message list changed while rebranding')

    id_map = {}  # old id -> (new id, kind)
    for (name, old_id, old_text), (_, new_id, _) in zip(old, new):
        if old_id == new_id:
            continue
        if old_id in id_map and id_map[old_id][0] != new_id:
            raise RuntimeError(f'{grd}: message {name} maps to two different new ids')
        if name == 'IDS_ABOUT_VERSION_COMPANY_NAME' and _ORIGINAL_AUTHORS in old_text:
            kind = 'company'
        elif name == 'IDS_ABOUT_VERSION_COPYRIGHT' and _ORIGINAL_AUTHORS in old_text:
            kind = 'copyright'
        else:
            kind = 'name'
        id_map[old_id] = (new_id, kind)

    translations = 0
    for xtb, lang in _xtb_files(grd):
        authors = AUTHORS.get(lang, AUTHORS['en'])

        def _translate(m, authors=authors, lang=lang):
            nonlocal translations
            if m.group(2) not in id_map:
                return m.group(0)
            new_id, kind = id_map[m.group(2)]
            translations += 1
            if kind == 'company':
                body = authors
            elif kind == 'copyright':
                body = COPYRIGHT_XTB.get(lang, COPYRIGHT_XTB['en']).format(authors=authors)
            else:
                body = _NAME_RE.sub(PRODUCT, m.group(4))
            return m.group(1) + new_id + m.group(3) + body + m.group(5)

        text = xtb.read_text(encoding='utf-8')
        new_text = _TRANSLATION_RE.sub(_translate, text)
        if new_text != text:
            xtb.write_text(new_text, encoding='utf-8', newline='')
    print(f'LUM rebrand: {grd.name}: {len(id_map)} strings, {changed_files} .grd/.grdp files, '
          f'{translations} translations')


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    source_tree = Path(sys.argv[1]).resolve()
    sys.path.insert(0, str(source_tree / 'tools' / 'grit'))
    for grd in GRD_FILES:
        _rebrand_grd(source_tree / grd)


if __name__ == '__main__':
    main()
