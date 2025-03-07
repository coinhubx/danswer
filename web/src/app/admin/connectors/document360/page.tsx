"use client";

import * as Yup from "yup";
import { TrashIcon, Document360Icon } from "@/components/icons/icons"; // Make sure you have a Document360 icon
import { fetcher } from "@/lib/fetcher";
import useSWR, { useSWRConfig } from "swr";
import { LoadingAnimation } from "@/components/Loading";
import { HealthCheckBanner } from "@/components/health/healthcheck";
import {
  Document360Config,
  Document360CredentialJson,
  ConnectorIndexingStatus,
  Credential,
} from "@/lib/types"; // Modify or create these types as required
import { adminDeleteCredential, linkCredential } from "@/lib/credential";
import { CredentialForm } from "@/components/admin/connectors/CredentialForm";
import {
  TextFormField,
  TextArrayFieldBuilder,
} from "@/components/admin/connectors/Field";
import { ConnectorsTable } from "@/components/admin/connectors/table/ConnectorsTable";
import { ConnectorForm } from "@/components/admin/connectors/ConnectorForm";
import { usePublicCredentials } from "@/lib/hooks";

const MainSection = () => {
  const { mutate } = useSWRConfig();
  const {
    data: connectorIndexingStatuses,
    isLoading: isConnectorIndexingStatusesLoading,
    error: isConnectorIndexingStatusesError,
  } = useSWR<ConnectorIndexingStatus<any, any>[]>(
    "/api/manage/admin/connector/indexing-status",
    fetcher
  );

  const {
    data: credentialsData,
    isLoading: isCredentialsLoading,
    error: isCredentialsError,
    refreshCredentials,
  } = usePublicCredentials();

  if (
    (!connectorIndexingStatuses && isConnectorIndexingStatusesLoading) ||
    (!credentialsData && isCredentialsLoading)
  ) {
    return <LoadingAnimation text="Loading" />;
  }

  if (isConnectorIndexingStatusesError || !connectorIndexingStatuses) {
    return <div>Failed to load connectors</div>;
  }

  if (isCredentialsError || !credentialsData) {
    return <div>Failed to load credentials</div>;
  }

  const document360ConnectorIndexingStatuses: ConnectorIndexingStatus<
    Document360Config,
    Document360CredentialJson
  >[] = connectorIndexingStatuses.filter(
    (connectorIndexingStatus) =>
      connectorIndexingStatus.connector.source === "document360"
  );

  const document360Credential:
    | Credential<Document360CredentialJson>
    | undefined = credentialsData.find(
    (credential) => credential.credential_json?.document360_api_token
  );

  return (
    <>
      <h2 className="font-bold mb-2 mt-6 ml-auto mr-auto">
        Step 1: Provide Credentials
      </h2>
      {document360Credential ? (
        <>
          <div className="flex mb-1 text-sm">
            <p className="my-auto">Existing Document360 API Token: </p>
            <p className="ml-1 italic my-auto">
              {document360Credential.credential_json.document360_api_token}
            </p>
            <button
              className="ml-1 hover:bg-gray-700 rounded-full p-1"
              onClick={async () => {
                await adminDeleteCredential(document360Credential.id);
                refreshCredentials();
              }}
            >
              <TrashIcon />
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm mb-4">
            To use the Document360 connector, you must first provide the API
            token and portal ID corresponding to your Document360 setup. For
            more details, see the{" "}
            <a
              className="text-blue-500"
              href="https://apidocs.document360.com/apidocs/api-token"
            >
              official Document360 documentation
            </a>
            .
          </p>
          <div className="border-solid border-gray-600 border rounded-md p-6 mt-2">
            <CredentialForm<Document360CredentialJson>
              formBody={
                <>
                  <TextFormField
                    name="document360_api_token"
                    label="Document360 API Token:"
                    type="password"
                  />
                  <TextFormField name="portal_id" label="Portal ID:" />
                </>
              }
              validationSchema={Yup.object().shape({
                document360_api_token: Yup.string().required(
                  "Please enter your Document360 API token"
                ),
                portal_id: Yup.string().required("Please enter your portal ID"),
              })}
              initialValues={{
                document360_api_token: "",
                portal_id: "",
              }}
              onSubmit={(isSuccess) => {
                if (isSuccess) {
                  refreshCredentials();
                }
              }}
            />
          </div>
        </>
      )}

      <h2 className="font-bold mb-2 mt-6 ml-auto mr-auto">
        Step 2: Which categories do you want to make searchable?
      </h2>

      {document360ConnectorIndexingStatuses.length > 0 && (
        <>
          <p className="text-sm mb-2">
            We index the latest articles from each workspace listed below
            regularly.
          </p>
          <div className="mb-2">
            <ConnectorsTable<Document360Config, Document360CredentialJson>
              connectorIndexingStatuses={document360ConnectorIndexingStatuses}
              liveCredential={document360Credential}
              getCredential={(credential) =>
                credential.credential_json.document360_api_token
              }
              specialColumns={[
                {
                  header: "Workspace",
                  key: "workspace",
                  getValue: (ccPairStatus) =>
                    ccPairStatus.connector.connector_specific_config.workspace,
                },
                {
                  header: "Categories",
                  key: "categories",
                  getValue: (ccPairStatus) =>
                    ccPairStatus.connector.connector_specific_config
                      .categories &&
                    ccPairStatus.connector.connector_specific_config.categories
                      .length > 0
                      ? ccPairStatus.connector.connector_specific_config.categories.join(
                          ", "
                        )
                      : "",
                },
              ]}
              onUpdate={() =>
                mutate("/api/manage/admin/connector/indexing-status")
              }
              onCredentialLink={async (connectorId) => {
                if (document360Credential) {
                  await linkCredential(connectorId, document360Credential.id);
                  mutate("/api/manage/admin/connector/indexing-status");
                }
              }}
            />
          </div>
        </>
      )}

      {document360Credential ? (
        <div className="border-solid border-gray-600 border rounded-md p-6 mt-4">
          <h2 className="font-bold mb-3">Connect to a New Workspace</h2>
          <ConnectorForm<Document360Config>
            nameBuilder={(values) =>
              values.categories
                ? `Document360Connector-${
                    values.workspace
                  }-${values.categories.join("_")}`
                : `Document360Connector-${values.workspace}`
            }
            source="document360"
            inputType="poll"
            formBody={
              <>
                <TextFormField name="workspace" label="Workspace" />
              </>
            }
            formBodyBuilder={TextArrayFieldBuilder({
              name: "categories",
              label: "Categories:",
              subtext:
                "Specify 0 or more categories to index. For instance, specifying the category " +
                "'Help' will cause us to only index all content " +
                "within the 'Help' category. " +
                "If no categories are specified, all categories in your workspace will be indexed.",
            })}
            validationSchema={Yup.object().shape({
              workspace: Yup.string().required(
                "Please enter the workspace to index"
              ),
              categories: Yup.array()
                .of(Yup.string().required("Category names must be strings"))
                .required(),
            })}
            initialValues={{
              workspace: "",
              categories: [],
            }}
            refreshFreq={10 * 60} // 10 minutes
            credentialId={document360Credential.id}
          />
        </div>
      ) : (
        <p className="text-sm">
          Please provide your Document360 API token and portal ID in Step 1
          first! Once done with that, you can then specify which Document360
          categories you want to make searchable.
        </p>
      )}
    </>
  );
};

export default function Page() {
  return (
    <div className="mx-auto container">
      <div className="mb-4">
        <HealthCheckBanner />
      </div>
      <div className="border-solid border-gray-600 border-b mb-4 pb-2 flex">
        <Document360Icon size={32} />
        <h1 className="text-3xl font-bold pl-2">Document360</h1>
      </div>
      <MainSection />
    </div>
  );
}
