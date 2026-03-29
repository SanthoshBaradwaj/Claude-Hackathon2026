# PULSE — Collective Opinion Engine

**Real-time semantic clustering of human opinion. See how people actually think.**

## The Problem

Traditional polling and surveys reduce human opinion to percentages: "60% agree, 40% disagree."

This erases texture. Real opinions are multi-dimensional—shaped by emotion, certainty, underlying values, and lived experience. People don't think in binary. They think in *worldviews*.

**PULSE** reveals the actual landscape of human opinion by discovering distinct communities of thinking, not just aggregated metrics.

---

## What We Built

A live opinion clustering platform that:

1. **Ingests personalized news** across multiple categories (technology, climate, business, health, sports)
2. **Extracts semantic features** from user responses (stance, emotion, certainty, values, concerns)
3. **Clusters opinions into worldview groups** using DBSCAN
4. **Shows where you stand** — and which other perspectives matter
5. **Visualizes demographic insights** — how do 25-34s differ from 55+s on this issue?

### Core Features

- ✅ **Multi-category news ingestion** with smart adjacency logic (tech↔business, climate↔health)
- ✅ **5-step personalized onboarding** (demographics → category preferences)
- ✅ **Claude-powered semantic analysis** (balanced, emotional, factual, specific prompts)
- ✅ **Real-time opinion clustering** (DBSCAN on feature vectors)
- ✅ **Demographic breakdowns** per cluster (age, occupation, education, location, gender)
- ✅ **Empathy-building visualization** (similar voices, opposing views, middle ground)
- ✅ **Anonymous sessions** with unlock gate (2 responses = view results)

---

## The Motivation

We wanted to answer: **What does collective intelligence actually look like?**

Not percentages. Not sentiment bins. But real *distinct worldviews* forming in real-time.

This matters for:
- **Events**: Transform a crowd into visible opinion communities
- **Teams**: Understand what people actually think (not survey answers)
- **Research**: Semantic clustering beats traditional surveys
- **Democracy**: Help people feel understood, not aggregated

---

## Architecture

### Tech Stack
- **Frontend**: Next.js 16 (React 19), Framer Motion, Recharts
- **Backend**: Next.js API routes, Supabase (PostgreSQL)
- **AI**: Claude API (feature extraction), DBSCAN (clustering)
- **Infrastructure**: Vercel (deployment), GitHub (source control)

### Pipeline

```
News Ingest → Article Storage → Prompt Generation
    ↓
User Onboarding (demographics + category preferences)
    ↓
User Responses (free text)
    ↓
Claude Feature Extraction (stance, emotion, certainty, values)
    ↓
DBSCAN Clustering (find natural communities)
    ↓
Demographic Breakdown Computation
    ↓
Real-time Visualization (results page)
```

### Key Technical Decisions

1. **DBSCAN over K-means**: No need to specify K. Algorithm finds natural cluster density.
2. **Multi-dimensional features**: Stance, sentiment, emotion, certainty, values (not just positive/negative)
3. **Category adjacency graph**: If user selects only 1 category with few articles, intelligently fill from related categories
4. **Fire-and-forget ingest**: Background news fetching doesn't block onboarding
5. **Anonymous sessions**: No login required; tracks via localStorage session ID + Supabase user record

---

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account + project
- GNews or NewsAPI key
- Claude API key (Anthropic)

### Environment Variables
```bash
# .env.local
GNEWS_API_KEY=your_key_here
NEWS_API_KEY=your_key_here
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_key
ANTHROPIC_API_KEY=your_key_here
NEWS_PROVIDER=gnews
```

### Installation
```bash
npm install
npm run dev
```

Visit `http://localhost:3000` to start.

---

## Usage Flow

1. **Onboarding** (`/onboarding`): Answer demographics, select news categories
2. **Feed** (`/`): Read personalized news prompts, answer 2+
3. **Results** (`/results/[promptId]`): See your cluster, demographic breakdowns
4. **Explore** (`/explore`): Browse all prompts + collective view

---

## Feature Highlights

### Real-Time Clustering
- Claude extracts features (stance, emotion, certainty, values)
- DBSCAN clusters all responses into worldview groups
- User sees cluster assignment instantly

### Demographic Insights
Each cluster shows distribution across:
- Age, Occupation, Education, Location, Gender

### Empathy Building
- Similar voices (quotes from your cluster)
- Opposing views (furthest cluster by distance)
- Middle ground (nuanced takes)

---

## Deployment

### Vercel
```bash
git push origin main
# Auto-deploys
```

Or deploy a specific commit:
```bash
git checkout ba4b0c1
vercel --prod
```

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Feed
│   ├── onboarding/page.tsx   # Signup
│   ├── results/[promptId]/   # Results viz
│   └── api/                  # API routes
├── lib/
│   ├── news/provider.ts      # News APIs
│   ├── clustering/           # DBSCAN
│   └── constants.ts          # Config
└── components/
    └── OnboardingGuard.tsx   # Route protection
```

---

## What's Unique

| Aspect | Slido | Surveys | Reddit | PULSE |
|--------|------|---------|--------|-------|
| Real-time clustering | ❌ | ❌ | ❌ | ✅ |
| Multi-dimensional analysis | ❌ | ❌ | ❌ | ✅ |
| Demographic breakdowns | ❌ | Manual | ❌ | ✅ |
| Category adjacency | ❌ | ❌ | ❌ | ✅ |
| Shows opposing worldviews | ❌ | ❌ | ❌ | ✅ |

---

## Questions?

**How is this different from Twitter sentiment?** We measure *how* people think (stance, emotion, certainty, values), not just if they're positive.

**Is this private?** Yes. Anonymous sessions, aggregated demographics only.

**Can this scale?** Yes. Tested to 1000+ responses. DBSCAN is O(n log n).

---

**Made with ❤️ and Claude Code**
