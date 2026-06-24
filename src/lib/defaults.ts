import type { Post, Profile, Project } from "./types";

export const defaultProfile: Profile = {
  id: "main",
  name: "홍길동",
  headline: "문제를 제품으로 바꾸는 프론트엔드 개발자",
  bio: "사용자가 이해하기 쉬운 웹 경험을 만드는 것을 좋아합니다. 이 사이트는 관리자 페이지에서 직접 소개, 프로젝트, 글을 수정할 수 있도록 준비된 포트폴리오 템플릿입니다.",
  location: "Seoul, Korea",
  email: "hello@example.com",
  github_url: "https://github.com",
  linkedin_url: "https://linkedin.com",
};

export const defaultProjects: Project[] = [
  {
    id: "starter-project",
    title: "포트폴리오 CMS",
    description:
      "Supabase 로그인과 데이터베이스를 연결해 직접 글과 프로젝트를 관리할 수 있는 개인 사이트입니다.",
    tags: ["Next.js", "Supabase", "Tailwind CSS"],
    url: "",
    repo_url: "",
    featured: true,
    sort_order: 1,
  },
  {
    id: "design-system",
    title: "반응형 랜딩 페이지",
    description:
      "모바일과 데스크톱에서 모두 읽기 좋은 소개 페이지와 프로젝트 섹션을 구성했습니다.",
    tags: ["UI", "Responsive", "Portfolio"],
    url: "",
    repo_url: "",
    featured: true,
    sort_order: 2,
  },
];

export const defaultPosts: Post[] = [
  {
    id: "first-post",
    title: "첫 번째 글",
    slug: "first-post",
    excerpt: "관리자 페이지에서 이 글을 수정하거나 새 글을 추가할 수 있습니다.",
    content:
      "이곳에는 포트폴리오 작업 과정, 배운 점, 프로젝트 회고 등을 자유롭게 작성할 수 있습니다.\n\nSupabase 환경 변수를 연결하면 관리자 로그인 후 실제 데이터베이스에 저장됩니다.",
    published: true,
    published_at: new Date().toISOString(),
  },
];
