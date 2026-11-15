import {
  AdminSectionPage,
  generateMetadata as sectionMetadata,
} from "../../section-page";

type Props = { params: Promise<{ subpage?: string[] }> };

function sectionProps({ params }: Props) {
  return { params: params.then((value) => ({ ...value, section: "content" })) };
}

export function generateMetadata(props: Props) {
  return sectionMetadata(sectionProps(props));
}

export default function Page(props: Props) {
  return <AdminSectionPage {...sectionProps(props)} />;
}
