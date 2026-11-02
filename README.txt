SYLUNEO WEBSITE: HOW TO PUT IT ONLINE
=====================================

What's in this folder
---------------------
index.html              Syluneo home page (syluneo.com): the quiz and all six tools
privacy-policy.html     Privacy Policy (replaces the old wellness-app policy, same address)
terms.html              Terms of Use (replaces the old wellness-app terms, same address)
support/index.html      Help page (syluneo.com/support/); support.html is a copy
404.html                "Page not found" page for old or mistyped links
assets/site.css         Shared look for the home, legal and help pages
moneybias/index.html    The MoneyBias game (syluneo.com/moneybias/)
moneybias/og.png        Preview image shown when the link is shared on WhatsApp, LinkedIn, etc.
moneybias/favicon.svg   Browser tab icon
favicon.ico             The same icon for browsers that ask for /favicon.ico
moneybias/fonts/        The three fonts, hosted on your own site (open licences included)

The site is plain static files. There is no server code, no database and no
advertising trackers. Fonts and scripts are served from syluneo.com itself.
The only outside request is the anonymous GoatCounter visit count.

The old mental-wellness site
----------------------------
The old wellness pages (course.html, audio, the old home, privacy policy
and terms) were removed on 2 November 2026. They remain in the git history
only. The new Privacy Policy and Terms keep the same web addresses.

Before relying on the Privacy Policy and Terms, have them checked by a
lawyer, and confirm the contact address and email are still correct.

Hosting
-------
The site is hosted free on GitHub Pages from the repository
syluneo/syluneo-website (branch main, root folder). The CNAME file sets the
domain to syluneo.com. Every change pushed to main goes live within a few
minutes. Do not delete the CNAME file.

The share and challenge links inside MoneyBias point to
https://syluneo.com/moneybias/ . If the domain ever changes, update SITE_URL
in moneybias/index.html and the canonical/og:url lines in the pages.

Privacy promise
---------------
The pages say: "No account needed. Your calculations happen in your browser.
We do not store your financial inputs." That is true of these files: nothing
anyone types is ever sent anywhere, and there are no cookies.

Visit counting (GoatCounter)
----------------------------
Dashboard: https://syluneo.goatcounter.com (log in with your GoatCounter account)
- assets/count.js is GoatCounter's open-source counting script (ISC licence),
  hosted on syluneo.com. It sends only page/screen names, referrer, screen
  width and browser type to syluneo.goatcounter.com/count.
- In MoneyBias, screens are counted as /moneybias/#<tool>, and events show as
  quiz-started, quiz-completed and result-<type>. No answers or amounts are sent.
- To stop counting your own visits on a device, open
  https://syluneo.com/#toggle-goatcounter once on that device.
- If you change what is counted, update privacy-policy.html section 5 and the
  "How privacy works" screen in moneybias/index.html.

Checking the maths
------------------
tests/calc_test.js contains 132 tests for every money formula (EMI, credit card
repayment, no-cost EMI, inflation, lifestyle inflation, discounts, formatting).
With Node.js installed, run from this folder:
    node tests/calc_test.js moneybias/index.html
