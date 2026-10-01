import { Console } from '../../features/shell/Console';
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  return <Console route={path} />;
}
