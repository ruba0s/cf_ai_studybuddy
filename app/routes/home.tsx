import type { Route } from "./+types/home";
import DocumentUploader from "~/components/DocumentUploader";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "New React Router App" },
		{ name: "description", content: "Welcome to React Router!" },
	];
}

export function loader({ context }: Route.LoaderArgs) {
	return { message: (context.cloudflare as { env: Record<string, string> }).env.VALUE_FROM_CLOUDFLARE };
}

export default function Home({ loaderData }: Route.ComponentProps) {
	return (
		<DocumentUploader/>
	);
}