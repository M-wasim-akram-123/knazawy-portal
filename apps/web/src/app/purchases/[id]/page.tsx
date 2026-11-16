import { PurchaseDetailScreen } from '../../../components/purchasing/PurchaseDetailScreen';

export default function PurchasePage({ params }: { params: { id: string } }) {
  return <PurchaseDetailScreen purchaseId={params.id} />;
}
