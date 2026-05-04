from playwright.sync_api import sync_playwright
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err.message}"))
    
    print("Navigating...")
    page.goto("http://localhost:5174")
    page.wait_for_timeout(5000)
    
    print("Zooming in...")
    page.mouse.move(500, 500)
    page.mouse.wheel(0, -2000)
    page.wait_for_timeout(2000)
    
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
