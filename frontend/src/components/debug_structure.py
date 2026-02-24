
import re

file_path = r"e:\ATSN\Agent_Emily\frontend\src\components\ATSNChatbot.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

stack = [] # Store indentation of open divs

for i, line in enumerate(lines):
    line_num = i + 1
    content = line.strip()
    
    # Simple heuristic: Count occurrences of <div and </div on the line
    # This doesn't handle multiple tags on one line perfectly if mixed with text, but works for standard formatted JSX
    
    open_count = len(re.findall(r"<div\b", line))
    close_count = len(re.findall(r"</div\b", line))
    
    indent = len(line) - len(line.lstrip())
    
    if open_count > 0 or close_count > 0:
        # print(f"{line_num:4d}: {indent:2d} | {'+'*open_count} {'-'*close_count} | {line.strip()}")
        pass
        
    for _ in range(open_count):
        stack.append((line_num, indent))
        
    for _ in range(close_count):
        if stack:
            stack.pop()
        else:
            print(f"ERROR: Extra close div at line {line_num}")

print(f"Remaining open divs: {len(stack)}")
for ln, ind in stack[:10]: # Print first 10
    print(f"Open at {ln} (indent {ind})")
if len(stack) > 10:
    print("...")
