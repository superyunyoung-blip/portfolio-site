# Portfolio CMS

관리자 로그인 후 소개, 프로젝트, 글을 직접 관리할 수 있는 포트폴리오 사이트입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 공개 사이트를 볼 수 있습니다.

## Supabase 연결

1. [Supabase](https://supabase.com)에서 새 프로젝트를 만듭니다.
2. `supabase/schema.sql`을 열고 관리자 이메일이 맞는지 확인합니다.
3. Supabase SQL Editor에서 수정한 SQL을 실행합니다.
4. Supabase Authentication에서 같은 이메일의 사용자를 만들고 비밀번호를 설정합니다.
5. `.env.example`을 참고해 `.env.local`을 만듭니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_ADMIN_EMAIL=your-email@example.com
```

`/admin`에서 로그인하면 소개, 프로필 사진, 프로젝트, 글, 대표 이미지를 관리할 수 있습니다.

이미지 업로드를 사용하려면 `supabase/schema.sql`을 다시 실행해 `portfolio-images` Storage 버킷과 이미지 컬럼을 만들어야 합니다.

## GitHub와 Vercel 무료 배포

1. [GitHub](https://github.com) 계정을 만들고 새 저장소를 생성합니다.
2. 이 프로젝트를 GitHub 저장소에 올립니다.
3. [Vercel](https://vercel.com)에서 GitHub 계정으로 로그인합니다.
4. `portfolio-site` 저장소를 Import 합니다.
5. Vercel Project Settings의 Environment Variables에 `.env.local`과 같은 값을 넣습니다.
6. Deploy를 누르면 `https://프로젝트명.vercel.app` 주소가 생성됩니다.

## 주요 경로

- `/`: 공개 포트폴리오 사이트
- `/posts/first-post`: 글 상세 페이지 예시
- `/admin`: 관리자 로그인 및 콘텐츠 관리
