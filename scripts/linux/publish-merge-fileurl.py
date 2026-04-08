#!/usr/bin/env python3
"""
Deb 安装后：在 publish.xml 中追加与 wpsjs debug 一致的 jspluginonline 节点，
使用 file:// 指向 /opt/chayuan-wps-addon/<addonFolder>/（WPS 部分版本只认 online 条目或无法解析相对 url）。
"""
from __future__ import annotations

import json
import pathlib
import sys
import xml.etree.ElementTree as ET


def main() -> None:
	if len(sys.argv) != 3:
		print("usage: publish-merge-fileurl.py <install_root> <publish.xml path>", file=sys.stderr)
		sys.exit(2)
	install_root = pathlib.Path(sys.argv[1]).resolve()
	publish_path = pathlib.Path(sys.argv[2]).resolve()
	meta_path = install_root / "install.json"
	if not meta_path.is_file():
		print(f"publish-merge: missing {meta_path}", file=sys.stderr)
		sys.exit(1)
	meta = json.loads(meta_path.read_text(encoding="utf-8"))
	name = meta["name"]
	addon_folder = meta["addonFolder"]
	addon_type = meta.get("addonType", "wps")
	file_uri = (install_root / addon_folder).resolve().as_uri() + "/"

	if not publish_path.is_file():
		print(f"publish-merge: missing {publish_path}", file=sys.stderr)
		sys.exit(1)

	tree = ET.parse(publish_path)
	root = tree.getroot()
	if root.tag != "jsplugins":
		print(f"publish-merge: unexpected root <{root.tag}>", file=sys.stderr)
		sys.exit(1)

	for child in list(root):
		if child.tag == "jspluginonline" and child.get("name") == name:
			root.remove(child)

	ET.SubElement(
		root,
		"jspluginonline",
		{
			"name": name,
			"type": addon_type,
			"url": file_uri,
			"debug": "",
			"enable": "enable",
			"install": "null",
			"customDomain": "",
		},
	)

	try:
		ET.indent(tree, space="    ")
	except AttributeError:
		pass

	tree.write(
		publish_path,
		encoding="UTF-8",
		xml_declaration=True,
		short_empty_elements=False,
	)
	print(f"publish-merge: jspluginonline url={file_uri}")


if __name__ == "__main__":
	main()
