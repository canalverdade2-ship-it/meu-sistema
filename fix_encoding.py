try:
    with open("src/components/admin/ScrapingAdminModule.tsx", "rb") as f:
        raw = f.read()
    
    text = raw.decode("utf-8")
    if text.startswith("\ufeff"):
        text = text[1:]
        
    try:
        original_bytes = text.encode("cp1252")
        clean_text = original_bytes.decode("utf-8")
        with open("src/components/admin/ScrapingAdminModule.tsx", "w", encoding="utf-8") as f:
            f.write(clean_text)
        print("Success repairing double-encoding with cp1252!")
    except Exception as e:
        print("CP1252 failed:", e)
        # Try latin1
        original_bytes = text.encode("latin1")
        clean_text = original_bytes.decode("utf-8")
        with open("src/components/admin/ScrapingAdminModule.tsx", "w", encoding="utf-8") as f:
            f.write(clean_text)
        print("Success repairing double-encoding with latin1!")
except Exception as e:
    print("Error:", e)