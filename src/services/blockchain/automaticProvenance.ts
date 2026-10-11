import type { Conversation } from '@/types';
import { useAppStore } from '@/store/appStore';
import { hashConversationArtifact } from '@/services/blockchain/monad';
import { submitProvenanceViaRelayer } from '@/services/blockchain/relayer';

const inFlight = new Set<string>();

export async function submitAutomaticProvenance(conversation: Conversation): Promise<void> {
  const provenance = conversation.provenance;
  if (
    !provenance ||
    provenance.status === 'verified' ||
    inFlight.has(conversation.id)
  ) {
    return;
  }

  inFlight.add(conversation.id);
  const update = useAppStore.getState().updateConversation;
  const submitting = {
    ...provenance,
    status: 'submitting' as const,
    error: undefined,
    updatedAt: new Date().toISOString(),
  };
  update(conversation.id, { provenance: submitting });

  try {
    const artifactHash = hashConversationArtifact(conversation);
    const proof = await submitProvenanceViaRelayer(
      artifactHash,
      `conversation:${conversation.id}`
    );
    update(conversation.id, {
      provenance: {
        ...submitting,
        status: 'verified',
        artifactHash,
        transactionHash: proof.transaction_hash,
        explorerUrl: proof.explorer_url,
        blockNumber: proof.block_number.toString(),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    update(conversation.id, {
      provenance: {
        ...provenance,
        status: 'pending',
        error: error instanceof Error ? error.message : 'Automatic provenance is waiting to retry.',
        updatedAt: new Date().toISOString(),
      },
    });
  } finally {
    inFlight.delete(conversation.id);
  }
}

export function retryPendingProvenance(): void {
  const conversations = useAppStore.getState().conversations;
  conversations
    .filter((conversation) => {
      const status = conversation.provenance?.status;
      return status === 'pending' || status === 'failed';
    })
    .forEach((conversation) => {
      void submitAutomaticProvenance(conversation);
    });
}
