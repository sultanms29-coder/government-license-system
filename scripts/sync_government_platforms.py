# -*- coding: utf-8 -*-
"""
مزامنة عامة للبيانات المنشورة للعامة في منصتي فرص واستطلاع.
تعمل من GitHub Actions مرتين يومياً، وتحفظ النتائج في data/opportunities.json.
لا تستخدم تسجيل دخول، ولا تتجاوز أي حماية أو صلاحيات.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "opportunities.json"

FURAS_URL = "https://furas.momah.gov.sa/ar/list-opportunities"
ISTITLAA_URL = "https://istitlaa.ncc.gov.sa/ar/Pages/default.aspx"

FURAS_KEYWORDS = [
    "رياضي", "رياضة", "نادي", "أندية", "لياقة", "مركز رياضي", "صالة رياضية",
    "ملعب", "مسبح", "ترفيه", "تجاري", "استثماري", "استثمار", "أرض",
    "مركز صحي", "مركز ترفيهي", "تشغيل وصيانة"
]

ISTITLAA_KEYWORDS = [
    "رياض", "نادي", "لياقة", "مركز رياضي", "بلدي", "بلدية", "استثمار",
    "ترخيص", "اشتراط", "سلامة", "دفاع مدني", "مستهلك", "مستفيد",
    "تجارة", "شركة", "عمل", "موارد بشرية", "عقار", "إيجار", "ترفيه"
]

EXCLUDE = [
    "تسجيل الدخول", "الرئيسية", "تواصل معنا", "سياسة الخصوصية",
    "الأسئلة الشائعة", "خريطة الموقع", "English", "الدعم"
]


def clean(value: str | None) -> str:
    value = re.sub(r"\s+", " ", value or "").strip()
    return value[:1200]


def uid(source: str, url: str, title: str) -> str:
    raw = f"{source}|{url}|{title}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:20]


def score(text: str, keywords: list[str]) -> int:
    normalized = text.casefold()
    return sum(2 if " " in k else 1 for k in keywords if k.casefold() in normalized)


def valid_title(text: str) -> bool:
    if len(text) < 8 or len(text) > 500:
        return False
    return not any(x.casefold() == text.casefold() for x in EXCLUDE)


async def dismiss_common_popups(page):
    labels = ["قبول", "موافق", "إغلاق", "اغلاق", "لاحقاً", "ليس الآن"]
    for label in labels:
        try:
            locator = page.get_by_text(label, exact=True)
            if await locator.count():
                await locator.first.click(timeout=1200)
        except Exception:
            pass


async def auto_scroll(page, rounds: int = 8):
    for _ in range(rounds):
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(900)


async def extract_cards(page, source: str, base_url: str, keywords: list[str]):
    # استخراج مرن يعتمد على الروابط والنص المحيط بها بدلاً من محدد CSS واحد قابل للكسر.
    rows = await page.locator("a[href]").evaluate_all(
        """els => els.map(a => {
          const box = a.closest('article, li, .card, [class*="card"], [class*="item"], [class*="opportun"], [class*="project"]') || a;
          const img = box.querySelector('img');
          return {
            href: a.href || a.getAttribute('href') || '',
            anchor: (a.innerText || a.textContent || '').trim(),
            text: (box.innerText || box.textContent || '').trim(),
            image: img ? (img.currentSrc || img.src || '') : ''
          };
        })"""
    )

    items = []
    seen = set()

    for row in rows:
        href = clean(row.get("href"))
        anchor = clean(row.get("anchor"))
        body = clean(row.get("text"))
        image = clean(row.get("image"))
        combined = clean(f"{anchor} {body}")

        if not href or href.startswith(("javascript:", "mailto:", "tel:")):
            continue
        href = urljoin(base_url, href)
        host = urlparse(href).netloc
        if host and not (
            host.endswith("momah.gov.sa")
            or host.endswith("ncc.gov.sa")
            or host.endswith("istitlaa.ncc.gov.sa")
        ):
            continue

        # تقليل روابط القوائم والتنقل
        path = urlparse(href).path.casefold()
        likely_detail = any(token in path for token in [
            "opportun", "project", "details", "detail", "pages", "investment"
        ])
        points = score(combined, keywords)
        if points == 0 or (not likely_detail and len(combined) < 25):
            continue

        title = anchor if valid_title(anchor) else body.split("  ")[0]
        title = clean(title)
        if not valid_title(title):
            continue

        key = (href.rstrip("/"), title.casefold())
        if key in seen:
            continue
        seen.add(key)

        items.append({
            "id": uid(source, href, title),
            "source": source,
            "title": title,
            "summary": body[:650],
            "url": href,
            "image": image,
            "relevance_score": points,
            "matched_keywords": [k for k in keywords if k.casefold() in combined.casefold()][:8],
            "fetched_at": datetime.now(timezone.utc).isoformat()
        })

    items.sort(key=lambda x: (-x["relevance_score"], x["title"]))
    return items[:120]


async def fetch_source(browser, source: str, url: str, keywords: list[str]):
    page = await browser.new_page(
        locale="ar-SA",
        viewport={"width": 1440, "height": 1200},
        user_agent=(
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "Chrome/126.0 Safari/537.36"
        ),
    )
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=90000)
        await dismiss_common_popups(page)
        await page.wait_for_timeout(5000)
        await auto_scroll(page)
        return await extract_cards(page, source, url, keywords), None
    except PlaywrightTimeoutError as exc:
        return [], f"{source}: انتهت مهلة تحميل الصفحة: {exc}"
    except Exception as exc:
        return [], f"{source}: {type(exc).__name__}: {exc}"
    finally:
        await page.close()


def merge_previous(current: list[dict], previous: list[dict]) -> list[dict]:
    # عند تعذر ظهور عنصر مؤقتاً، يحتفظ النظام بآخر نسخة لمدة معقولة بدل حذف كل شيء.
    merged = {item.get("id"): item for item in previous if item.get("id")}
    for item in current:
        merged[item["id"]] = item
    values = list(merged.values())
    values.sort(key=lambda x: (-int(x.get("relevance_score", 0)), x.get("title", "")))
    return values[:200]


async def main():
    previous = {}
    if OUTPUT.exists():
        try:
            previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
        except Exception:
            previous = {}

    errors = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        furas, error = await fetch_source(browser, "فرص", FURAS_URL, FURAS_KEYWORDS)
        if error:
            errors.append(error)

        istitlaa, error = await fetch_source(browser, "استطلاع", ISTITLAA_URL, ISTITLAA_KEYWORDS)
        if error:
            errors.append(error)
        await browser.close()

    # لا نستبدل البيانات السابقة بقائمة فارغة إذا كان الموقع متوقفاً أو تغير مؤقتاً.
    if not furas:
        furas = previous.get("furas", [])
    if not istitlaa:
        istitlaa = previous.get("istitlaa", [])

    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "status": "ok" if not errors else "partial",
        "furas": merge_previous(furas, previous.get("furas", [])),
        "istitlaa": merge_previous(istitlaa, previous.get("istitlaa", [])),
        "errors": errors,
        "meta": {
            "version": "4.1",
            "schedule": "03:15 و15:15 بتوقيت UTC يومياً",
            "owner": "sultanms29",
            "public_sources_only": True
        }
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Furas={len(payload['furas'])}, Istitlaa={len(payload['istitlaa'])}, errors={len(errors)}")


if __name__ == "__main__":
    asyncio.run(main())
