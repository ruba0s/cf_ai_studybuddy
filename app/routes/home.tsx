import type { Route } from "./+types/home";
import DocumentUploader from "~/components/DocumentUploader";
import { useProcessingStatus } from '../hooks/useProcessingStatus';
import { useNavigate } from "react-router";
import { useState } from "react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Study Buddy — Upload & Learn" },
    { name: "description", content: "Upload a document and start learning with AI-powered flashcards and spaced repetition." },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
	return { message: (context.cloudflare as { env: Record<string, string> }).env.VALUE_FROM_CLOUDFLARE };
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const navigate = useNavigate();
	const [uploadedMaterialId, setUploadedMaterialId] = useState<string | null>(null);

	const { status, questionCount } = useProcessingStatus({
		materialId: uploadedMaterialId,
		onReady: () => navigate('/quiz'),
	});

	return (
		<div>
		<DocumentUploader onUploadComplete={(materialId) => setUploadedMaterialId(materialId)} />

		{uploadedMaterialId && status === 'pending' && (
			<p className="text-sm text-blue-600 mt-4 text-center animate-pulse">
			Generating questions from your material...
			</p>
		)}
		{status === 'timeout' && (
			<p className="text-sm text-red-500 mt-4 text-center">
			Processing is taking longer than expected. Try refreshing.
			</p>
		)}
		{status === 'ready' && (
			<p className="text-sm text-green-600 mt-4 text-center">
			{questionCount} questions ready! Redirecting...
			</p>
		)}
		</div>
	);
}