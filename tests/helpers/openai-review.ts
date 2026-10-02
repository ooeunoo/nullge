/** Test helpers for the shared editor-review pass that follows content planning. */
type Fetch = (url: any, init?: any) => Promise<Response>;
const reviewName = (init?: any) => {
  try {
    return JSON.parse(init?.body ?? '{}').response_format?.json_schema?.name;
  } catch {
    return undefined;
  }
};
export const isReview = (init?: any) => reviewName(init) === 'nullge_candidate_review';

/**
 * Wraps a fetch mock so review requests get an approving review that keeps the planner's order.
 * Pass `scores` to rank by index, or `reject` to reject every candidate.
 */
export function withReview(fetch: Fetch, opts: { scores?: number[]; reject?: boolean } = {}): Fetch {
  return async (url, init) => {
    if (!String(url).includes('openai.com') || !isReview(init)) return fetch(url, init);
    const items = JSON.parse(JSON.parse(init.body).messages[1].content) as { index: number }[];
    const reviews = items.map(({ index }) => {
      const s = opts.scores?.[index] ?? 4;
      return {
        index,
        specificity: s,
        brandFit: s,
        grounded: 5,
        hook: s,
        fun: s,
        reject: !!opts.reject,
        reason: '테스트 검수',
      };
    });
    return new Response(
      JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ reviews }) } }],
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  };
}
/** Planning (non-review) OpenAI calls recorded by a vi.fn fetch mock. */
export const planningCalls = (mock: { mock: { calls: any[][] } }) =>
  mock.mock.calls.filter(([url, init]) => String(url).includes('openai.com') && !isReview(init));
