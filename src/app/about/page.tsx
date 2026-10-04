import { TrustPage } from '@/components/seo/TrustPage';
import { trustPages } from '@/config/trust';
import { pageMetadata } from '@/lib/seo';
const content = trustPages.about;
export const metadata = pageMetadata('/about', content.title + ' | FileNimble', content.description);
export default function Page() { return <TrustPage slug="about" />; }
