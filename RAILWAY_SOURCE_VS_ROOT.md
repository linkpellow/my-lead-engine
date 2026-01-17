# Railway: Source Repo vs Root Directory

## 📚 Key Difference

### **Source Repo** (GitHub Repository)
- **What it is**: The GitHub repository that contains your code
- **Example**: `linkpellow/scrapeshifter`
- **Where to set**: When creating a new service → "GitHub Repo" → Select repository
- **Purpose**: Tells Railway which GitHub repo to pull code from

### **Root Directory** (Subdirectory Path)
- **What it is**: The folder within that repo where the service code lives
- **Example**: `brainscraper` or `scrapegoat`
- **Where to set**: Service Settings → General → Root Directory
- **Purpose**: Tells Railway which subdirectory to build from

## 🎯 For Your Monorepo

```
GitHub Repo: linkpellow/scrapeshifter
├── brainscraper/     ← Root Directory for BrainScraper service
├── scrapegoat/       ← Root Directory for Scrapegoat service
└── docker-compose.yml
```

### Configuration in Railway Dashboard:

**BrainScraper Service:**
- **Source**: `linkpellow/scrapeshifter` (the GitHub repo)
- **Root Directory**: `brainscraper` (the subfolder)

**Scrapegoat Service:**
- **Source**: `linkpellow/scrapeshifter` (same GitHub repo)
- **Root Directory**: `scrapegoat` (different subfolder)

## ✅ Quick Answer

- **Source Repo**: `linkpellow/scrapeshifter` (same for all services)
- **Root Directory**: 
  - BrainScraper: `brainscraper`
  - Scrapegoat: `scrapegoat`
  - Scrapegoat Worker: `scrapegoat`

Both services use the **same source repo** but different **root directories**.
