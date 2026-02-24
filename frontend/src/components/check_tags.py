
import re

file_path = r"e:\ATSN\Agent_Emily\frontend\src\components\ATSNChatbot.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Simple regex for div tags
# Note: This is imperfect for commented out code, but gives a hint.
open_divs = len(re.findall(r"<div\b", content))
close_divs = len(re.findall(r"</div\b", content))

print(f"Open divs: {open_divs}")
print(f"Close divs: {close_divs}")
print(f"Diff: {open_divs - close_divs}")

# Check for other common tags
tags = ["span", "button", "p"]
for tag in tags:
    o = len(re.findall(rf"<{tag}\b", content))
    c = len(re.findall(rf"</{tag}\b", content))
    if o != c:
        print(f"Mismatch {tag}: {o} open, {c} close (Diff: {o-c})")

