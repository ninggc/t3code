import type { ThreadTitleMessage } from "@t3tools/provider-core/server/threadTitleContext";

export const threadTitleEvaluationCases = [
  {
    id: "topic-reuse",
    source: "Personal fork issue #12",
    request: "复用当前项目中已有的会话管理主题。",
    previousTitle: "增加挂起功能",
    relatedTitles: ["会话管理 - 会话搜索", "快捷键 - 终端焦点修复"],
    messages: [{ role: "user", text: "Snooze 增加 Never 选项，永不自动唤醒，但可以手动恢复。" }],
    rubric: "使用会话管理作为大主题，格式为会话管理 - 小主题，小主题准确描述 Snooze 长期挂起。",
  },
  {
    id: "topic-new",
    source: "Personal fork issue #12",
    request: "没有匹配主题时自主确定新主题。",
    previousTitle: "处理问题",
    relatedTitles: ["会话管理 - 会话搜索", "快捷键 - 终端焦点修复"],
    messages: [{ role: "user", text: "修复账单页面重复扣款的问题，并保留退款记录。" }],
    rubric:
      "自主确定账单或支付相关大主题，不强行复用无关主题，不使用待定，不向用户提问，使用大主题 - 小主题格式。",
  },
  {
    id: "topic-unknown",
    source: "Personal fork issue #12",
    request: "信息不足时使用待定。",
    previousTitle: "看看这个",
    relatedTitles: ["会话管理 - 会话搜索"],
    messages: [{ role: "user", text: "帮我看看这个，详细情况稍后再发。" }],
    rubric: "使用待定 - 小主题，不从其他会话臆测当前主题，不要求用户选择大主题。",
  },
  {
    id: "topic-stable",
    source: "Personal fork issue #12",
    request: "准确且符合格式的已有标题保持稳定。",
    previousTitle: "快捷键 - 终端焦点修复",
    relatedTitles: ["快捷键 - 编辑器导航", "终端 - 登录 Shell"],
    messages: [
      { role: "user", text: "修复侧边会话按快捷键打开终端后的焦点问题。" },
      { role: "assistant", text: "焦点处理已修复，测试通过。" },
      { role: "user", text: "提交并合并。" },
    ],
    rubric: "完整保留快捷键 - 终端焦点修复，不因提交合并或存在终端主题而改写准确标题。",
  },
  {
    id: "topic-refine",
    source: "Personal fork issue #12",
    request: "有新信息后重新生成待定标题。",
    previousTitle: "待定 - 排查启动失败",
    relatedTitles: ["桌面应用 - Mac 安装包"],
    messages: [
      { role: "user", text: "帮我看一下启动失败。" },
      { role: "assistant", text: "Mac 桌面应用启动时无法载入 Electron 主进程模块。" },
      { role: "user", text: "修好这个 Electron 启动问题。" },
    ],
    rubric: "复用桌面应用作为大主题，小主题描述 Electron 启动失败，不再保留待定。",
  },
  {
    id: "linked-reset-credits",
    source: "https://github.com/pingdotgg/t3code/pull/10462",
    request: "Review the reset credit routing change.",
    previousTitle: "Review PR 10462",
    messages: [{ role: "user", text: "Review https://github.com/pingdotgg/t3code/pull/10462" }],
    rubric: "Name reset credit routing. Distinguish it from displaying credit balances.",
  },
  {
    id: "onboarding-merge",
    source: "https://github.com/pingdotgg/t3code/pull/10465",
    request: "Make onboarding one shared wizard across computers, then merge when green.",
    previousTitle: "Finish onboarding PR",
    messages: [
      { role: "user", text: "Make onboarding one shared wizard across computers." },
      {
        role: "assistant",
        text: "The wizard now handles pairing, agent selection, and project import.",
      },
      { role: "user", text: "File a PR and merge it when green." },
    ],
    rubric: "Keep the multi-computer onboarding subject. Do not title it after merging.",
  },
  {
    id: "vague-opening",
    source: "Existing lazy thread feed title scenario",
    request: "A failing test is later identified as a lazy thread feed mismatch.",
    previousTitle: "Fix failing test",
    messages: [
      { role: "user", text: "Fix this failing test." },
      {
        role: "assistant",
        text: "The lazy thread feed test expects a full message body before the client requests it.",
      },
    ],
    rubric: "Name the lazy thread feed test. Do not invent a wider mobile regression.",
  },
  {
    id: "scope-change",
    source: "Title context budget scenario",
    request: "Change the goal from QR layout to pairing expiry, despite long assistant replies.",
    previousTitle: "Improve QR layout",
    messages: [
      { role: "user", text: "Improve QR sharing layout." },
      {
        role: "user",
        text: "Change of plan. Fix pairing token expiry. Keep remote access working.",
      },
      {
        role: "assistant",
        text: "The token expires before redemption. " + "Implementation detail. ".repeat(800),
      },
      { role: "user", text: "Ship it." },
    ],
    rubric: "Name pairing expiry and honor the explicit scope change.",
  },
  {
    id: "review-umbrella",
    source: "Existing subagent monitoring title scenario",
    request: "Review subagent monitoring risks. A Codex roster issue is one finding.",
    previousTitle: "Review subagent monitoring risks",
    messages: [
      { role: "user", text: "Review subagent monitoring risks." },
      {
        role: "assistant",
        text: "One finding is a stale Codex roster. " + "Roster detail. ".repeat(800),
      },
      { role: "user", text: "Fix the findings and babysit CI." },
    ],
    rubric: "Preserve the monitoring review scope. The previous title can stay unchanged.",
  },
  {
    id: "long-opening",
    source: "Title message truncation scenario",
    request: "Investigate Android pairing while preserving the iOS flow.",
    previousTitle: "Inspect logs",
    messages: [
      {
        role: "user",
        text:
          "Investigate Android pairing. " +
          "Connection logs. ".repeat(800) +
          " Preserve the iOS pairing flow.",
      },
    ],
    rubric: "Name Android pairing. Logs are supporting evidence.",
  },
  {
    id: "research",
    source: "Maintainer title generation request",
    request: "How can we improve title generation in T3 Code?",
    previousTitle: "Research title gen improvements",
    messages: [
      { role: "user", text: "How can we improve title gen further in T3 Code?" },
      {
        role: "assistant",
        text: "Prioritize user messages, refine vague titles once, and resolve PR subjects.",
      },
      {
        role: "user",
        text: "Make these changes and file a PR. Babysit until everything is green.",
      },
    ],
    rubric: "Keep title generation as the subject. Do not focus on filing the PR.",
  },
] satisfies ReadonlyArray<{
  id: string;
  source: string;
  request: string;
  previousTitle: string;
  relatedTitles?: ReadonlyArray<string>;
  messages: ReadonlyArray<ThreadTitleMessage>;
  rubric: string;
}>;
