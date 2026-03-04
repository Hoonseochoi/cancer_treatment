import fitz
doc = fitz.open("test/test12.pdf")
text = ""
for page in doc:
    text += page.get_text()

with open("test12_raw.txt", "w", encoding="utf-8") as f:
    f.write(text)
