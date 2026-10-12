# Reading a Jira source via MCP

Load the Atlassian tools with `ToolSearch` (`select:getAccessibleAtlassianResources,getJiraIssue`),
get the `cloudId` from `getAccessibleAtlassianResources`, then `getJiraIssue` with the key.
Pull summary, description, acceptance criteria (if any), status, and the comment thread
(comments often hold the real requirements). If the MCP is unreachable, STOP and ask the
developer to paste the US with `inline`.
