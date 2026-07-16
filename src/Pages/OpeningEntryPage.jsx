import OpeningEntry from '../Components/OpeningEntry/OpeningEntry'

function OpeningEntryPage({ onOpeningEntrySuccess, isModal, onCancel }) {
  return <OpeningEntry onOpeningEntrySuccess={onOpeningEntrySuccess} isModal={isModal} onCancel={onCancel} />;
}

export default OpeningEntryPage