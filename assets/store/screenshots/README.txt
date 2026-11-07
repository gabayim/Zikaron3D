ZIKARON3D - APP STORE SCREENSHOTS
=================================

Apple requires real screenshots of the app (guideline 2.3): invented gameplay is a
rejection. These frames only decorate captures you take on a device.

SIZES (Apple, as of iOS 26)
  iPhone 6.9"  ->  1320 x 2868 px  portrait  (3-10 images, required)
  iPad 13"     ->  2064 x 2752 px  portrait  (3-10 images, required while
                                              app.json has supportsTablet = true)

HOW TO CAPTURE
  1. Install the 2.15.0 TestFlight build on a 6.9" iPhone (16 Pro Max class) and
     a 13" iPad.
  2. Set the app up: enough progress to show the hub carousel, one mid-level
     Burrows round, an Orb Merge board with a few merges, a populated weekly
     leaderboard, the Collection shelf, and the parental gate dialog.
  3. Screenshot with the device buttons (or the TestFlight "screenshot" gesture).
  4. Copy the files here as (portrait PNG, any resolution - they are cropped to fit):

        source/iphone-1.png   hub carousel          "Seven worlds to explore"
        source/iphone-2.png   TOYBOX burrows round  "A kid-safe mode for ages 4-7"
        source/iphone-3.png   orb merge             "Merge, chain and climb the ladder"
        source/iphone-4.png   leaderboard           "A new weekly arcade league"
        source/iphone-5.png   collection shelf      "Collect and dress up fifteen critters"
        source/iphone-6.png   parental gate dialog  "Grown-up check before every purchase"

        source/ipad-1.png ... source/ipad-4.png     (same first four captions)

  Rules: no prices, no promo codes, no "download now" overlays, no other
  platforms' UI.

BUILD
  python scripts/assets/buildScreenshots.py --templates   # review the frame design
  python scripts/assets/buildScreenshots.py               # real composites -> final/

  final/iphone-1..6.png and final/ipad-1..4.png are the files to upload in
  App Store Connect (or via scripts/deploy/asc-* once captures exist).

BRAND
  Icon and logo come from python scripts/assets/buildBrand.py (real Pip art):
    assets/icon.png                    1024x1024, RGB, no alpha (App Store icon)
    assets/splash-icon.png             transparent mark
    assets/android-icon-*.png          adaptive foreground/background/monochrome
    assets/brand/logo-dark.png         wordmark on transparent (dark backgrounds)
    assets/brand/logo-light.png        wordmark for light backgrounds
    assets/brand/og-image.png          1200x630 share card
