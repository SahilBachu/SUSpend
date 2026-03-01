export default function PolicyViewer() {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
      <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
        <h3 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-indigo-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Company Spending Policy
        </h3>
      </div>
      <div className="p-6 prose prose-zinc prose-sm max-w-none text-zinc-600 flex-grow">
        <div className="space-y-4">
          <p className="leading-relaxed text-base">
            Employees are expected to exercise good judgment and discretion when
            incurring business expenses. All expenses must be reasonable,
            necessary, and directly related to company business.
          </p>
          <div className="bg-amber-50 rounded-xl p-5 border border-amber-100 shadow-sm mt-4">
            <h4 className="text-amber-800 font-semibold mb-3 border-b border-amber-200/60 pb-2 flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Key Guidelines
            </h4>
            <ul className="space-y-2 text-amber-900/80 text-sm list-none p-0">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold mt-0.5">•</span>
                <span>
                  <strong>Meals:</strong> Maximum $50 per day for individual
                  travel.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold mt-0.5">•</span>
                <span>
                  <strong>Travel:</strong> Economy class for flights under 6
                  hours.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold mt-0.5">•</span>
                <span>
                  <strong>Accommodations:</strong> Standard room rates at
                  preferred hotel partners.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold mt-0.5">•</span>
                <span>
                  <strong>Receipts:</strong> Required for all expenses over $25.
                </span>
              </li>
            </ul>
          </div>
          <div className="mt-6 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
            <p className="leading-relaxed text-sm text-indigo-900/80">
              <strong className="text-indigo-900">Auditor Instructions:</strong>{" "}
              When auditing an employee, verify that all submitted expenses
              adhere to these guidelines. Flag any transactions that exceed
              limits, lack proper documentation, or appear unrelated to business
              activities.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
