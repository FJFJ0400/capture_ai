import Link from "next/link";

export default function ChromeTestPage() {
  return (
    <section className="panel-grid">
      <article className="card">
        <h2>크롬 테스트 가이드</h2>
        <p style={{ marginTop: 0 }}>
          공유시트 없이도 크롬에서 <code>/share-intake</code> 플로우를 직접 검증할 수 있습니다.
        </p>
        <ol style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18 }}>
          <li>아래 폼에서 이미지 파일을 선택합니다.</li>
          <li>전송 버튼을 눌러 공유 인입 라우트로 POST 합니다.</li>
          <li>
            <code>/mobile-save</code>로 리다이렉트되면 저장하기를 눌러 업로드를 완료합니다.
          </li>
        </ol>
      </article>

      <article className="card">
        <h2>공유 인입 플로우 테스트</h2>
        <p style={{ marginTop: 0 }}>
          이 폼은 크롬에서 Web Share Target 호출을 수동으로 재현하기 위한 테스트 전용 진입점입니다.
        </p>
        <form
          action="/share-intake"
          method="post"
          encType="multipart/form-data"
          style={{ display: "grid", gap: 10 }}
        >
          <input className="input" type="file" name="files" accept="image/*" multiple required />
          <button className="button" type="submit">
            공유 인입 테스트 실행
          </button>
        </form>
      </article>

      <article className="card">
        <h2>일반 업로드 테스트</h2>
        <p style={{ marginTop: 0 }}>
          기존 다중 업로드 UX는 인입함에서 바로 테스트할 수 있습니다.
        </p>
        <Link className="button" href="/inbox">
          인입함 열기
        </Link>
      </article>
    </section>
  );
}
