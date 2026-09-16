"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <h2>Bir sayfa takıldı.</h2>
      <p>İstek tamamlanamadı. Biraz sonra yeniden deneyebilirsin.</p>
      <button onClick={reset} className="button button-dark">
        Yeniden dene
      </button>
    </div>
  );
}
