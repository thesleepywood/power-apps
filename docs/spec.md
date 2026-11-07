## Context

Prototype for small fintech engineering team that wants to replace low-code internal-tools (such as Microsoft Power Apps) with a small owned customizable codebase. Build a shared foundation, then a KYC review queue that tests the foundation, then a refunds dashboard built cheaply on top. Should look and feel like a polished finished product. 

## Expectations

#### Build
1. **Foundation:** Login roles, permissions, approvals, change log, hiding sensitive data, plain app registry and the design system: app shell with sidebar navigation, shared colors and type, tables, status badges, record pages, confirmation dialogs, and empty and error states. Three roles shared by every app: "Operator" does the daily work, "Approver" handles anything that needs sign-off, "Observer" can read but change nothing. Home page with full record.
2. Two separate apps that test the foundation:
	1. **KYC Review Queue**: States are pending, waiting for approver (high-risk), approved, rejected. Operators and approvers approve or reject low-risk cases, high-risk cases go to waiting for approver and only an approver can approve them. Masked SSNs. 
	2. **Refunds Dashboard:** Operators and approvers request refunds, $1000 or less approved right away, over $1000 needs an approver. A requestor can never approve their own. Built only from foundation pieces with no foundation changes.

**Do not build**: Real sign-in, customer data or services, database, or app generator. If something else seems worth adding, suggest it in PR instead. 

**Stack**: Run with one command and nothing to install in demo. TypeScript, React, small server, data in memory. 

**Look:** Modern tool with its own identity that a fintech operation team uses every day, not a test harness. Clear pages with obvious actions. When something isn't allowed, screen says why. 

**Constraints:** Server decides who can do what and masks sensitive data. Every change writes one change-log entry. A person can never approve their own request.

**Sequence:**
Plan first and wait for my go-ahead. Finish Foundation, then KYC Review Queue, then Refunds Dashboard, each as its own PR with screenshots. Send screenshots and a test report at the end of each PR and stop for feedback. 
## Success Criteria

Demo passes end to end, example people per role. README explains what it does and how to run it. Constraints have tests. Fictional sample data: 10 KYC cases, 2 high-risk, with name, fake SSN, risk level, status, review reason, summary and opened date. 10 refunds of $5–$2,000 including at least one over $1,000 requested by one of the approvers, with customer, amount, status, requestor, reason, summary and requested date.

`npm install && npm run demo` starts everything with nothing else installed. `npm run check` runs all tests.