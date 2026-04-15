// ── Types ────────────────────────────────────────────────────────────────────

export type Status = 'active' | 'paused' | 'draft' | 'ended';

export interface RawMetrics {
  clicks: number;
  impressions: number;
  leads: number;
  conversions: number;
  spent: number;
}

export interface Ad extends RawMetrics {
  id: string;
  name: string;
  status: Status;
}

export interface AdSet extends RawMetrics {
  id: string;
  name: string;
  status: Status;
  ads: Ad[];
}

export interface Campaign extends RawMetrics {
  id: string;
  name: string;
  status: Status;
  adSets: AdSet[];
}

export interface Platform {
  id: string;
  name: string;
  campaigns: Campaign[];
}

// ── Mock Data ────────────────────────────────────────────────────────────────

export const mockData: Platform[] = [
  // ── Google Ads ─────────────────────────────────────────────────────────────
  {
    id: 'google',
    name: 'Google Ads',
    campaigns: [
      {
        id: 'g-brand',
        name: 'Brand Keywords — Cars24 India',
        status: 'active',
        clicks: 18420, impressions: 312000, leads: 2180, conversions: 940, spent: 552600,
        adSets: [
          {
            id: 'g-brand-exact',
            name: 'Exact Match — Buy Used Cars',
            status: 'active',
            clicks: 10240, impressions: 168000, leads: 1260, conversions: 540, spent: 307200,
            ads: [
              {
                id: 'g-b-e-1',
                name: 'Cars24 — Best Deals on Used Cars',
                status: 'active',
                clicks: 5820, impressions: 94000, leads: 720, conversions: 308, spent: 174600,
              },
              {
                id: 'g-b-e-2',
                name: 'Buy Certified Used Cars Online — Cars24',
                status: 'active',
                clicks: 4420, impressions: 74000, leads: 540, conversions: 232, spent: 132600,
              },
            ],
          },
          {
            id: 'g-brand-broad',
            name: 'Broad Match — Second Hand Cars',
            status: 'active',
            clicks: 8180, impressions: 144000, leads: 920, conversions: 400, spent: 245400,
            ads: [
              {
                id: 'g-b-b-1',
                name: 'Second Hand Cars at Best Prices',
                status: 'active',
                clicks: 4610, impressions: 82000, leads: 530, conversions: 228, spent: 138300,
              },
              {
                id: 'g-b-b-2',
                name: 'Certified Pre-Owned Cars from Cars24',
                status: 'paused',
                clicks: 3570, impressions: 62000, leads: 390, conversions: 172, spent: 107100,
              },
            ],
          },
        ],
      },
      {
        id: 'g-competitor',
        name: 'Competitor Targeting',
        status: 'active',
        clicks: 9640, impressions: 196000, leads: 860, conversions: 310, spent: 385600,
        adSets: [
          {
            id: 'g-comp-olx',
            name: 'OLX Autos Competitor',
            status: 'active',
            clicks: 5820, impressions: 114000, leads: 510, conversions: 188, spent: 232800,
            ads: [
              {
                id: 'g-c-o-1',
                name: 'Better Than OLX — Sell Your Car Fast',
                status: 'active',
                clicks: 3240, impressions: 62000, leads: 290, conversions: 106, spent: 129600,
              },
              {
                id: 'g-c-o-2',
                name: 'Cars24 vs OLX — We Pay More',
                status: 'active',
                clicks: 2580, impressions: 52000, leads: 220, conversions: 82, spent: 103200,
              },
            ],
          },
          {
            id: 'g-comp-spinny',
            name: 'Spinny Competitor',
            status: 'paused',
            clicks: 3820, impressions: 82000, leads: 350, conversions: 122, spent: 152800,
            ads: [
              {
                id: 'g-c-s-1',
                name: 'Better Prices Than Spinny',
                status: 'paused',
                clicks: 2110, impressions: 46000, leads: 196, conversions: 68, spent: 84400,
              },
              {
                id: 'g-c-s-2',
                name: 'Cars24 — Instant Car Valuation',
                status: 'active',
                clicks: 1710, impressions: 36000, leads: 154, conversions: 54, spent: 68400,
              },
            ],
          },
        ],
      },
      {
        id: 'g-category',
        name: 'Used Cars by Category',
        status: 'active',
        clicks: 14280, impressions: 268000, leads: 1540, conversions: 620, spent: 428400,
        adSets: [
          {
            id: 'g-cat-suv',
            name: 'SUV Category',
            status: 'active',
            clicks: 7840, impressions: 148000, leads: 860, conversions: 344, spent: 235200,
            ads: [
              {
                id: 'g-ca-s-1',
                name: 'Buy Used SUVs — Best Deals',
                status: 'active',
                clicks: 4320, impressions: 82000, leads: 476, conversions: 190, spent: 129600,
              },
              {
                id: 'g-ca-s-2',
                name: 'Certified Used SUVs Under ₹10L',
                status: 'active',
                clicks: 3520, impressions: 66000, leads: 384, conversions: 154, spent: 105600,
              },
            ],
          },
          {
            id: 'g-cat-sedan',
            name: 'Sedan Category',
            status: 'active',
            clicks: 6440, impressions: 120000, leads: 680, conversions: 276, spent: 193200,
            ads: [
              {
                id: 'g-ca-sed-1',
                name: 'Best Used Sedans — Cars24',
                status: 'active',
                clicks: 3680, impressions: 68000, leads: 388, conversions: 156, spent: 110400,
              },
              {
                id: 'g-ca-sed-2',
                name: 'Certified Sedans Starting ₹3L',
                status: 'active',
                clicks: 2760, impressions: 52000, leads: 292, conversions: 120, spent: 82800,
              },
            ],
          },
        ],
      },
      {
        id: 'g-city',
        name: 'City Targeting — Delhi NCR',
        status: 'active',
        clicks: 11060, impressions: 224000, leads: 1320, conversions: 530, spent: 331800,
        adSets: [
          {
            id: 'g-city-buy',
            name: 'Delhi NCR — Buy Intent',
            status: 'active',
            clicks: 6320, impressions: 128000, leads: 760, conversions: 306, spent: 189600,
            ads: [
              {
                id: 'g-ci-b-1',
                name: 'Buy Used Cars in Delhi — Cars24',
                status: 'active',
                clicks: 3620, impressions: 74000, leads: 436, conversions: 174, spent: 108600,
              },
              {
                id: 'g-ci-b-2',
                name: 'Delhi Used Car Deals — Cars24',
                status: 'active',
                clicks: 2700, impressions: 54000, leads: 324, conversions: 132, spent: 81000,
              },
            ],
          },
          {
            id: 'g-city-sell',
            name: 'Delhi NCR — Sell Intent',
            status: 'active',
            clicks: 4740, impressions: 96000, leads: 560, conversions: 224, spent: 142200,
            ads: [
              {
                id: 'g-ci-s-1',
                name: 'Sell Your Car in Delhi — Best Price',
                status: 'active',
                clicks: 2640, impressions: 54000, leads: 314, conversions: 124, spent: 79200,
              },
              {
                id: 'g-ci-s-2',
                name: 'Instant Car Valuation Delhi — Cars24',
                status: 'draft',
                clicks: 2100, impressions: 42000, leads: 246, conversions: 100, spent: 63000,
              },
            ],
          },
        ],
      },
    ],
  },

  // ── Meta ───────────────────────────────────────────────────────────────────
  {
    id: 'meta',
    name: 'Meta',
    campaigns: [
      {
        id: 'm-leadgen',
        name: 'Lead Generation — Mumbai',
        status: 'active',
        clicks: 22640, impressions: 840000, leads: 3420, conversions: 680, spent: 478600,
        adSets: [
          {
            id: 'm-lg-owners',
            name: 'Mumbai 25–45 Car Owners',
            status: 'active',
            clicks: 12480, impressions: 460000, leads: 1880, conversions: 376, spent: 263600,
            ads: [
              {
                id: 'm-l-o-1',
                name: 'Sell Your Car in 2 Hours — Mumbai',
                status: 'active',
                clicks: 6840, impressions: 254000, leads: 1040, conversions: 208, spent: 144400,
              },
              {
                id: 'm-l-o-2',
                name: 'Instant Car Valuation Mumbai',
                status: 'active',
                clicks: 5640, impressions: 206000, leads: 840, conversions: 168, spent: 119200,
              },
            ],
          },
          {
            id: 'm-lg-lookalike',
            name: 'Mumbai Lookalike — Buyers',
            status: 'active',
            clicks: 10160, impressions: 380000, leads: 1540, conversions: 304, spent: 215000,
            ads: [
              {
                id: 'm-l-l-1',
                name: 'Top Used Cars Mumbai — Cars24',
                status: 'active',
                clicks: 5480, impressions: 204000, leads: 830, conversions: 164, spent: 115800,
              },
              {
                id: 'm-l-l-2',
                name: 'Finance Available — Used Cars Mumbai',
                status: 'active',
                clicks: 4680, impressions: 176000, leads: 710, conversions: 140, spent: 99200,
              },
            ],
          },
        ],
      },
      {
        id: 'm-retarget',
        name: 'Retargeting — Website Visitors',
        status: 'active',
        clicks: 8960, impressions: 320000, leads: 1560, conversions: 420, spent: 268800,
        adSets: [
          {
            id: 'm-ret-7d',
            name: '7-Day Website Visitors',
            status: 'active',
            clicks: 5640, impressions: 196000, leads: 980, conversions: 264, spent: 169200,
            ads: [
              {
                id: 'm-r-7-1',
                name: 'Still Looking? Check These Cars',
                status: 'active',
                clicks: 3120, impressions: 108000, leads: 542, conversions: 146, spent: 93600,
              },
              {
                id: 'm-r-7-2',
                name: 'Your Saved Cars Are Available Now',
                status: 'active',
                clicks: 2520, impressions: 88000, leads: 438, conversions: 118, spent: 75600,
              },
            ],
          },
          {
            id: 'm-ret-30d',
            name: '30-Day Non-Converters',
            status: 'paused',
            clicks: 3320, impressions: 124000, leads: 580, conversions: 156, spent: 99600,
            ads: [
              {
                id: 'm-r-30-1',
                name: 'Special Offer — ₹5000 Cashback',
                status: 'active',
                clicks: 1960, impressions: 72000, leads: 342, conversions: 92, spent: 58800,
              },
              {
                id: 'm-r-30-2',
                name: 'Limited Time Deal on Used Cars',
                status: 'paused',
                clicks: 1360, impressions: 52000, leads: 238, conversions: 64, spent: 40800,
              },
            ],
          },
        ],
      },
      {
        id: 'm-awareness',
        name: 'Brand Awareness — Tier 2 Cities',
        status: 'active',
        clicks: 14200, impressions: 1240000, leads: 1840, conversions: 286, spent: 312000,
        adSets: [
          {
            id: 'm-aw-t2',
            name: 'Tier 2 Cities Expansion',
            status: 'active',
            clicks: 8640, impressions: 760000, leads: 1120, conversions: 174, spent: 190000,
            ads: [
              {
                id: 'm-a-t-1',
                name: 'Cars24 Now in Your City',
                status: 'active',
                clicks: 4820, impressions: 424000, leads: 628, conversions: 96, spent: 106040,
              },
              {
                id: 'm-a-t-2',
                name: 'Certified Used Cars Near You',
                status: 'active',
                clicks: 3820, impressions: 336000, leads: 492, conversions: 78, spent: 83960,
              },
            ],
          },
          {
            id: 'm-aw-video',
            name: 'Video Awareness — Young Buyers',
            status: 'active',
            clicks: 5560, impressions: 480000, leads: 720, conversions: 112, spent: 122000,
            ads: [
              {
                id: 'm-a-v-1',
                name: 'Cars24 Story — 30s Video',
                status: 'active',
                clicks: 3060, impressions: 264000, leads: 396, conversions: 62, spent: 67100,
              },
              {
                id: 'm-a-v-2',
                name: 'Why Cars24 — Customer Stories',
                status: 'active',
                clicks: 2500, impressions: 216000, leads: 324, conversions: 50, spent: 54900,
              },
            ],
          },
        ],
      },
    ],
  },

  // ── LinkedIn ───────────────────────────────────────────────────────────────
  {
    id: 'linkedin',
    name: 'LinkedIn',
    campaigns: [
      {
        id: 'li-b2b',
        name: 'B2B Dealer Acquisition',
        status: 'active',
        clicks: 2840, impressions: 68000, leads: 312, conversions: 86, spent: 284000,
        adSets: [
          {
            id: 'li-b2b-dm',
            name: 'Auto Dealer Decision Makers',
            status: 'active',
            clicks: 1820, impressions: 42000, leads: 198, conversions: 54, spent: 182000,
            ads: [
              {
                id: 'li-b-d-1',
                name: 'Partner with Cars24 — Expand Your Business',
                status: 'active',
                clicks: 1040, impressions: 24000, leads: 114, conversions: 32, spent: 104000,
              },
              {
                id: 'li-b-d-2',
                name: 'Cars24 Dealer Network — Apply Now',
                status: 'active',
                clicks: 780, impressions: 18000, leads: 84, conversions: 22, spent: 78000,
              },
            ],
          },
          {
            id: 'li-b2b-finance',
            name: 'Auto Finance Professionals',
            status: 'paused',
            clicks: 1020, impressions: 26000, leads: 114, conversions: 32, spent: 102000,
            ads: [
              {
                id: 'li-b-f-1',
                name: 'Cars24 Finance Partnership Program',
                status: 'paused',
                clicks: 620, impressions: 16000, leads: 70, conversions: 20, spent: 62000,
              },
              {
                id: 'li-b-f-2',
                name: 'Auto Finance Solutions — Cars24 B2B',
                status: 'draft',
                clicks: 400, impressions: 10000, leads: 44, conversions: 12, spent: 40000,
              },
            ],
          },
        ],
      },
      {
        id: 'li-talent',
        name: 'Talent Acquisition — Tech',
        status: 'active',
        clicks: 1640, impressions: 52000, leads: 184, conversions: 42, spent: 164000,
        adSets: [
          {
            id: 'li-tal-tech',
            name: 'Senior Tech Professionals',
            status: 'active',
            clicks: 1640, impressions: 52000, leads: 184, conversions: 42, spent: 164000,
            ads: [
              {
                id: 'li-t-t-1',
                name: 'Join Cars24 — Build the Future of Auto',
                status: 'active',
                clicks: 960, impressions: 30000, leads: 108, conversions: 24, spent: 96000,
              },
              {
                id: 'li-t-t-2',
                name: 'Senior Engineers Wanted — Cars24',
                status: 'active',
                clicks: 680, impressions: 22000, leads: 76, conversions: 18, spent: 68000,
              },
            ],
          },
        ],
      },
    ],
  },
];
