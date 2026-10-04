import { TrustPage } from '@/components/seo/TrustPage';
import { trustPages } from '@/config/trust';
import { pageMetadata } from '@/lib/seo';
const content = trustPages.terms;
export const metadata = pageMetadata('/terms', content.title + ' | FileNimble', content.description);
export default function Page() { return <TrustPage slug="terms" />; }
