# Setup prompt for Claude Code

**How to use:** put this kit's files in an empty folder (e.g. `smart-home-hackathon`), open that
folder in VS Code, start Claude Code, and say:

> Read SETUP-PROMPT.md and do the setup it describes. Ask me before installing any system software.

---

## Instructions for Claude Code

You are setting up the workspace for a one-day hackathon. Read `CLAUDE.md` first for context.
**Do not write any application code in this repo tonight** (hackathon rules may require code be
written on the day). Tooling, config and docs only. Work through the steps in order, report
briefly after each, and stop to ask if something fails twice.

### 1. Check prerequisites
- Detect the OS (Windows / macOS / Linux) and shell. Adapt every command below to it.
- Check: `node -v` (need LTS, 20+), `npm -v`, `git --version`, `gh --version`.
- If anything is missing, tell me the exact install command (Windows: `winget install
  OpenJS.NodeJS.LTS`, `winget install Git.Git`, `winget install GitHub.cli`; macOS: Homebrew)
  and **wait for my OK** before running it.
- Check `gh auth status`; if not logged in, tell me to run `gh auth login` myself (it's interactive).

### 2. Initialize the repo
- `git init` (default branch `main`).
- Create `.gitignore`: `node_modules/`, `dist/`, `.env`, `.env.*`, `!.env.example`, `.vercel/`,
  `.playwright-mcp/`, `*.log`, `.DS_Store`.
- Create `.env.example` with `ANTHROPIC_API_KEY=` and `OPENAI_API_KEY=` (empty values).

### 3. Install skills (project scope, so they are committed and my teammate gets them on clone)
Run each, choosing **project** scope (not global) and Claude Code as the agent if prompted:
```
npx skills add anthropics/skills --skill frontend-design --agent claude-code
npx skills add shadcn-ui/ui --skill shadcn --agent claude-code
npx skills add pbakaus/impeccable --skill impeccable --agent claude-code
```
- Confirm each landed in `.claude/skills/<name>/SKILL.md`. If the CLI put them elsewhere,
  move them there.
- **Security review:** list every file in each skill folder. Flag any scripts (`.sh`, `.ps1`,
  `.py`, `.js`) or instructions that run commands, fetch URLs, or touch files outside the
  project, and summarize what they do. Do not run any of them.

### 4. Add the Playwright MCP (project scope, committed in `.mcp.json`)
Create `.mcp.json`:
- macOS/Linux:
  `{"mcpServers":{"playwright":{"command":"npx","args":["@playwright/mcp@latest"]}}}`
- Windows (native, not WSL) needs the `cmd /c` wrapper:
  `{"mcpServers":{"playwright":{"command":"cmd","args":["/c","npx","@playwright/mcp@latest"]}}}`
- Run `npx playwright install chromium` so a browser is available.

### 5. Speed up permissions
Create `.claude/settings.json` allowing routine dev commands without prompting:
```json
{
  "permissions": {
    "allow": [
      "Bash(npm install:*)", "Bash(npm run:*)", "Bash(npx shadcn@latest:*)",
      "Bash(git add:*)", "Bash(git commit:*)", "Bash(git status:*)", "Bash(git diff:*)",
      "Bash(git log:*)", "Bash(git checkout:*)"
    ],
    "deny": ["Read(./.env)", "Read(./.env.*)"]
  }
}
```

### 6. Commit and push to GitHub
- `git add -A && git commit -m "Hackathon workspace: context, skills, MCP config"`.
- `gh repo create smart-home-hackathon --private --source=. --push`.
- Ask me for my teammate's GitHub username, then
  `gh api -X PUT repos/{owner}/smart-home-hackathon/collaborators/<username> -f permission=push`.

### 7. Smoke test (OUTSIDE this repo)
In a sibling throwaway folder (e.g. `../stack-test`), verify the stack works end to end:
- `npm create vite@latest stack-test -- --template react-ts`, install, add Tailwind (v4 Vite
  plugin), init shadcn/ui, add the `card` and `chart` components and `recharts`.
- Render one card with a small line chart of fake numbers; run `npm run build` to confirm it compiles.
- This also warms the npm cache so tomorrow's installs are fast. Leave the folder; I'll delete it.

### 8. Report
Give me a short checklist of what's done, anything that failed, and remind me to:
1. **Restart Claude Code** in this folder and approve the `playwright` MCP server when asked.
2. Then test it: start the smoke-test app (`npm run dev` in `../stack-test`) and ask Claude to
   open it with Playwright and take a screenshot.
