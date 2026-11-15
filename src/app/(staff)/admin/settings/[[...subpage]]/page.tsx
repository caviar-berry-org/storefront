import {
  AdminSectionPage,
  generateMetadata as sectionMetadata,
} from "../../section-page";
import { AdminHelp } from "@/components/staff/admin-help";
import { AdminSectionTabs } from "@/components/staff/admin-section-tabs";
import { getAdminSection } from "@/components/staff/navigation";
import { ServiceDirectory } from "@/components/staff/settings/service-directory";
import { TeamDirectory } from "@/components/staff/settings/team-directory";
import { StaffHeading } from "@/components/staff/staff-heading";
import { StaffHelp } from "@/components/staff/staff-help";
import { StaffNotice } from "@/components/staff/staff-feedback";
import { canManageTeam, staffEmail } from "@/domain/staff-team";
import { settingsCopy } from "@/i18n/settings-staff-uk";
import { requireStaffSession } from "@/lib/server/staff-session";
import { readStaffTeam } from "@/lib/server/staff-team";

type Props = { params: Promise<{ subpage?: string[] }> };

function sectionProps({ params }: Props) {
  return {
    params: params.then((value) => ({ ...value, section: "settings" })),
  };
}

export function generateMetadata(props: Props) {
  return sectionMetadata(sectionProps(props));
}

export default async function Page(props: Props) {
  const { subpage = [] } = await props.params;
  if (subpage.length === 1 && subpage[0] === "help") {
    await requireStaffSession();
    return <AdminHelp />;
  }
  if (subpage.length === 1 && subpage[0] === "services") {
    await requireStaffSession();
    return <ServiceDirectory />;
  }
  if (subpage.length <= 1 && (subpage[0] ?? "team") === "team") {
    const session = await requireStaffSession();
    const copy = settingsCopy.team;
    const members = await readStaffTeam(staffEmail(session.email)).catch(
      () => null,
    );
    return (
      <>
        <StaffHeading
          title={copy.title}
          tools={<StaffHelp label={copy.help} text={copy.helpText} />}
        />
        <AdminSectionTabs
          section={getAdminSection(["settings"])!.section}
          selected="team"
        />
        {members ? (
          <TeamDirectory
            members={members}
            canManage={canManageTeam(session.role)}
          />
        ) : (
          <StaffNotice message={copy.errors.unavailable} guidance="retry" />
        )}
      </>
    );
  }
  return <AdminSectionPage {...sectionProps(props)} />;
}
