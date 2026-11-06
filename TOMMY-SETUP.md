# Tommy's setup (about 20 minutes, do it tonight)

You don't need a Claude subscription. You'll use Claude Code with the $50 API credit from the event.

## Tonight

1. **Install the basics** (skip any you already have):
   - **Node.js LTS**: https://nodejs.org (Windows: run the installer; Mac: installer or `brew install node`)
   - **Git**: https://git-scm.com/downloads
   - **VS Code**: https://code.visualstudio.com
2. **Make a GitHub account** at github.com if you don't have one, and **text Aiden your username**
   so he can add you to the team repo. Accept the invite email.
3. **Install Claude Code in VS Code**: Extensions panel (Ctrl+Shift+X / Cmd+Shift+X), search
   **"Claude Code"**, install the one published by **Anthropic**.
4. **Create a Claude Console account** at https://platform.claude.com. This is where the
   $50 credit lands Friday. (Different from a regular Claude.ai account.)
5. **Create an OpenAI Platform account** at https://platform.openai.com (for the $50 OpenAI credit).
6. **Get the project**: in VS Code, open the Command Palette (Ctrl+Shift+P / Cmd+Shift+P),
   choose **Git: Clone**, paste `https://github.com/AidenKnecht/SMART-HOME.git`, and open the folder.
7. **Install the test browser**: in VS Code open a terminal (Ctrl+` ) and run
   `npx playwright install chromium`.

## Friday morning

1. **Check in with Aiden by 8:00.** We both have to sign the agreement in person.
2. **Claim the Claude credit right away** when they share the link (it runs out). Claim it while
   signed in to *your* Console account.
3. **Redeem the OpenAI credit** from the email OpenAI sends you (check spam). Sign in at
   platform.openai.com first, then open the link.
4. **Sign in to Claude Code**: open the Claude Code panel in VS Code, choose to sign in with
   your **Anthropic Console** account (not a Claude.ai subscription).
5. When Claude Code asks whether to trust the project's **playwright** and **context7** MCP servers, say yes to both.
6. Quick test: ask Claude Code "Summarize CLAUDE.md in 3 bullets."

## Your role on the day (proposed)
- 8:40–10:30: lead the clinician interviews (Homeroom, 4th floor). Write down exact quotes in the
  "Clinician notes" section of CLAUDE.md, or text them to Aiden.
- Afterward: own the pitch and demo script (`docs/demo-outline.md`), test the app as a "clinician,"
  and make small UI changes with Claude Code.
- Keep your API key private. Delete it in the Console after the event.
