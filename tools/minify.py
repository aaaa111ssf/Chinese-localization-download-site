#!/usr/bin/env python3
"""把 app.js / style.css 压成真正的最小体积，输出 app.min.js / style.min.css。
用法：python tools/minify.py
说明：只用标准库，不需要联网装包。模板字符串原样保留，避免改坏页面文案。
"""

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# 这些符号后面出现 / 时，它是正则开头而不是除号
REGEX_AFTER_PUNCT = set('(,=:[!&|?{};+-*%<>~^')
REGEX_AFTER_WORDS = {
    'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete',
    'void', 'case', 'do', 'else', 'yield', 'await', 'throw',
}

PUNCTUATORS = [
    '>>>=', '...', '===', '!==', '**=', '>>>', '<<=', '>>=', '&&=', '||=', '??=',
    '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--',
    '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '**',
    '{', '}', '(', ')', '[', ']', ';', ',', '<', '>', '+', '-', '*', '/',
    '%', '&', '|', '^', '!', '~', '?', ':', '=', '.',
]


def scan_string(src, i):
    """从引号开始，跳完整个字符串/模板字面量。"""
    quote = src[i]
    n = len(src)
    i += 1
    while i < n:
        ch = src[i]
        if ch == '\\':
            i += 2
        elif quote == '`' and src.startswith('${', i):
            i = scan_template_expr(src, i + 2)
        elif ch == quote:
            return i + 1
        else:
            i += 1
    return n


def scan_template_expr(src, i):
    """跳过模板里 ${...} 这一段，返回右花括号之后的位置。"""
    n = len(src)
    depth = 1
    while i < n:
        ch = src[i]
        if ch in '"\'':
            i = scan_string(src, i)
        elif ch == '`':
            i = scan_string(src, i)
        elif ch == '{':
            depth += 1
            i += 1
        elif ch == '}':
            depth -= 1
            i += 1
            if depth == 0:
                return i
        else:
            i += 1
    return n


def scan_number(src, i):
    n = len(src)
    while i < n and (src[i].isalnum() or src[i] in '._'):
        i += 1
    return i


def scan_ident(src, i):
    n = len(src)
    while i < n and (src[i].isalnum() or src[i] in '_$' or ord(src[i]) > 127):
        i += 1
    return i


def scan_regex(src, i):
    n = len(src)
    i += 1
    in_class = False
    while i < n:
        ch = src[i]
        if ch == '\\':
            i += 2
        elif ch == '[':
            in_class = True
            i += 1
        elif ch == ']':
            in_class = False
            i += 1
        elif ch == '/' and not in_class:
            i += 1
            break
        elif ch == '\n':
            break
        else:
            i += 1
    while i < n and src[i].isalpha():
        i += 1
    return i


def regex_allowed(prev):
    if not prev:
        return True
    if prev in REGEX_AFTER_WORDS:
        return True
    return len(prev) == 1 and prev in REGEX_AFTER_PUNCT


def is_word_char(ch):
    return ch.isalnum() or ch in '_$' or ord(ch) > 127


def need_space(prev, tok):
    """两个 token 挨在一起会不会变成别的意思，会就补一个空格。"""
    if not prev or not tok:
        return False
    a, b = prev[-1], tok[0]
    if is_word_char(a) and is_word_char(b):
        return True
    if a == b and a in '+-':
        return True
    if a == '/' and b in '/*':
        return True
    if a == '<' and b == '!':
        return True
    if a == '.' and b.isdigit():
        return True
    return False


def minify_js(src):
    out = []
    i, n = 0, len(src)
    prev = ''
    pending_nl = False

    while i < n:
        ch = src[i]

        if ch in ' \t\r\n':
            j = i
            while j < n and src[j] in ' \t\r\n':
                if src[j] == '\n':
                    pending_nl = True
                j += 1
            i = j
            continue

        if ch == '/' and i + 1 < n and src[i + 1] == '/':
            j = src.find('\n', i)
            i = n if j < 0 else j
            pending_nl = True
            continue

        if ch == '/' and i + 1 < n and src[i + 1] == '*':
            j = src.find('*/', i + 2)
            end = n if j < 0 else j + 2
            if '\n' in src[i:end]:
                pending_nl = True
            i = end
            continue

        start = i
        if ch in '"\'':
            i = scan_string(src, i)
            tok = src[start:i]
        elif ch == '`':
            i = scan_string(src, i)
            tok = src[start:i]
        elif ch.isdigit() or (ch == '.' and i + 1 < n and src[i + 1].isdigit()):
            i = scan_number(src, i)
            tok = src[start:i]
        elif ch.isalpha() or ch in '_$' or ord(ch) > 127:
            i = scan_ident(src, i)
            tok = src[start:i]
        elif ch == '/' and regex_allowed(prev):
            i = scan_regex(src, i)
            tok = src[start:i]
        else:
            tok = None
            for p in PUNCTUATORS:
                if src.startswith(p, i):
                    tok = p
                    break
            if tok is None:
                tok = ch
            i += len(tok)

        sep = '\n' if pending_nl else (' ' if need_space(prev, tok) else '')
        out.append(sep + tok)
        prev = tok
        pending_nl = False

    return ''.join(out).strip() + '\n'


def minify_css(src):
    # 字符串原样保留，只压字符串外面的空白，避免改坏 content 里的文字
    parts = []
    buf = []
    i, n = 0, len(src)
    while i < n:
        ch = src[i]
        if ch == '/' and i + 1 < n and src[i + 1] == '*':
            j = src.find('*/', i + 2)
            i = n if j < 0 else j + 2
            continue
        if ch in '"\'':
            parts.append(('c', ''.join(buf)))
            buf = []
            j = i + 1
            while j < n:
                if src[j] == '\\':
                    j += 2
                elif src[j] == ch:
                    j += 1
                    break
                else:
                    j += 1
            parts.append(('s', src[i:j]))
            i = j
            continue
        buf.append(ch)
        i += 1
    parts.append(('c', ''.join(buf)))

    out = []
    for kind, text in parts:
        if kind == 's':
            out.append(text)
            continue
        text = ' '.join(text.split())
        if not text:
            out.append('')
            continue
        text = text.replace(' {', '{').replace('{ ', '{')
        text = text.replace(' }', '}').replace('} ', '}')
        text = text.replace(' ;', ';').replace('; ', ';')
        text = text.replace(' ,', ',').replace(', ', ',')
        text = text.replace(': ', ':')
        text = text.replace(' > ', '>')
        out.append(text)

    text = ''.join(out).strip()
    text = text.replace('{ ', '{').replace(' }', '}')
    return text + '\n'


def build(name_in, name_out, fn):
    src_path = ROOT / name_in
    out_path = ROOT / name_out
    src = src_path.read_text(encoding='utf-8')
    out = fn(src)
    out_path.write_text(out, encoding='utf-8')
    before, after = len(src.encode('utf-8')), len(out.encode('utf-8'))
    print(f'{name_out}: {before/1024:.1f}KB -> {after/1024:.1f}KB  ({100 - after*100/before:.0f}% 更小)')


if __name__ == '__main__':
    build('app.js', 'app.min.js', minify_js)
    build('style.css', 'style.min.css', minify_css)
    print('done')
