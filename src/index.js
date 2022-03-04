/* eslint-disable no-console */
// @ts-check
import { resolveConfig } from '@netlify/config';
import { listFrameworks } from '@netlify/framework-info';
import fs from 'fs';
import {
  GraphQL,
  NetlifyGraph,
  OneGraphClient,
} from 'netlify-onegraph-internal';
import path from 'path';

const { Kind, parse, print } = GraphQL

/**
 * Remove any relative path components from the given path
 * @param {string[]} items Filesystem path items to filter
 * @return {string[]} Filtered filesystem path items
 */
const filterRelativePathItems = (items) => items.filter((part) => part !== '');

/**
 * Return the default Netlify Graph configuration for a generic site
 * @param {object} context
 * @param {object} context.baseConfig
 * @param {string[]} context.detectedFunctionsPath
 * @param {string[]} context.siteRoot
 */
const makeDefaultNetlifyGraphConfig = ({
  baseConfig,
  detectedFunctionsPath,
}) => {
  const functionsPath = filterRelativePathItems([...detectedFunctionsPath]);
  const webhookBasePath = '/.netlify/functions';
  const netlifyGraphPath = [...functionsPath, 'netlifyGraph'];
  const netlifyGraphImplementationFilename = [
    ...netlifyGraphPath,
    `index.${baseConfig.extension}`,
  ];
  const netlifyGraphTypeDefinitionsFilename = [
    ...netlifyGraphPath,
    `index.d.ts`,
  ];
  const graphQLOperationsSourceFilename = [
    ...netlifyGraphPath,
    NetlifyGraph.defaultSourceOperationsFilename,
  ];
  const graphQLOperationsSourceDirectory = [
    ...netlifyGraphPath,
    NetlifyGraph.defaultSourceOperationsDirectoryName,
  ];
  const graphQLSchemaFilename = [
    ...netlifyGraphPath,
    NetlifyGraph.defaultGraphQLSchemaFilename,
  ];
  const netlifyGraphRequirePath = [`./netlifyGraph`];
  const moduleType = baseConfig.moduleType || 'esm';

  return {
    functionsPath,
    webhookBasePath,
    netlifyGraphPath,
    netlifyGraphImplementationFilename,
    netlifyGraphTypeDefinitionsFilename,
    graphQLOperationsSourceDirectory,
    graphQLOperationsSourceFilename,
    graphQLSchemaFilename,
    netlifyGraphRequirePath,
    moduleType,
  };
};

/**
 * Return the default Netlify Graph configuration for a Nextjs site
 * @param {object} context
 * @param {object} context.baseConfig
 * @param {string[]} context.detectedFunctionsPath
 * @param {string[]} context.siteRoot
 */
const makeDefaultNextJsNetlifyGraphConfig = ({ baseConfig, siteRoot }) => {
  const functionsPath = filterRelativePathItems([...siteRoot, 'pages', 'api']);
  const webhookBasePath = '/api';
  const netlifyGraphPath = filterRelativePathItems([
    ...siteRoot,
    'lib',
    'netlifyGraph',
  ]);
  const netlifyGraphImplementationFilename = [
    ...netlifyGraphPath,
    `index.${baseConfig.extension}`,
  ];
  const netlifyGraphTypeDefinitionsFilename = [
    ...netlifyGraphPath,
    `index.d.ts`,
  ];
  const graphQLOperationsSourceFilename = [
    ...netlifyGraphPath,
    NetlifyGraph.defaultSourceOperationsFilename,
  ];
  const graphQLSchemaFilename = [
    ...netlifyGraphPath,
    NetlifyGraph.defaultGraphQLSchemaFilename,
  ];
  const graphQLOperationsSourceDirectory = [...netlifyGraphPath, ...NetlifyGraph.defaultSourceOperationsDirectoryName]
  const netlifyGraphRequirePath = ['..', '..', 'lib', 'netlifyGraph'];
  const moduleType = baseConfig.moduleType || 'esm';

  return {
    functionsPath,
    webhookBasePath,
    netlifyGraphPath,
    netlifyGraphImplementationFilename,
    netlifyGraphTypeDefinitionsFilename,
    graphQLOperationsSourceDirectory,
    graphQLOperationsSourceFilename,
    graphQLSchemaFilename,
    netlifyGraphRequirePath,
    moduleType,
  };
};

/**
 * Return the default Netlify Graph configuration for a Remix site
 * @param {object} context
 * @param {object} context.baseConfig
 * @param {string[]} context.detectedFunctionsPath
 * @param {string[]} context.siteRoot
 */
const makeDefaultRemixNetlifyGraphConfig = ({
  baseConfig,
  detectedFunctionsPath,
  siteRoot,
}) => {
  const functionsPath = filterRelativePathItems([...detectedFunctionsPath]);
  const webhookBasePath = '/webhooks';
  const netlifyGraphPath = filterRelativePathItems([
    ...siteRoot,
    ...NetlifyGraph.defaultNetlifyGraphConfig.netlifyGraphPath,
  ]);
  const netlifyGraphImplementationFilename = [
    ...netlifyGraphPath,
    `index.${baseConfig.extension}`,
  ];
  const netlifyGraphTypeDefinitionsFilename = [
    ...netlifyGraphPath,
    `index.d.ts`,
  ];
  const graphQLOperationsSourceFilename = [
    ...netlifyGraphPath,
    NetlifyGraph.defaultSourceOperationsFilename,
  ];
  const graphQLSchemaFilename = [
    ...netlifyGraphPath,
    NetlifyGraph.defaultGraphQLSchemaFilename,
  ];
  const graphQLOperationsSourceDirectory = [...netlifyGraphPath, ...NetlifyGraph.defaultSourceOperationsDirectoryName]

  const netlifyGraphRequirePath = [`../../netlify/functions/netlifyGraph`];
  const moduleType = 'esm';

  return {
    functionsPath,
    webhookBasePath,
    netlifyGraphPath,
    netlifyGraphImplementationFilename,
    netlifyGraphTypeDefinitionsFilename,
    graphQLOperationsSourceDirectory,
    graphQLOperationsSourceFilename,
    graphQLSchemaFilename,
    netlifyGraphRequirePath,
    moduleType,
  };
};

const defaultFrameworkLookup = {
  next: makeDefaultNextJsNetlifyGraphConfig,
  remix: makeDefaultRemixNetlifyGraphConfig,
  default: makeDefaultNetlifyGraphConfig,
};

const getNetlifyGraphConfig = async ({ config, options, site }) => {
  config.dev = { ...config.dev };
  config.build = { ...config.build };
  const userSpecifiedConfig = (config && config.graph) || {};

  const frameworks = await listFrameworks();
  const detectedFrameworkId = frameworks[0] && frameworks[0].id;

  const siteRoot = [
    path.sep,
    ...filterRelativePathItems(process.cwd().split(path.sep)),
  ];

  const makeDefaultFrameworkConfig =
    defaultFrameworkLookup[detectedFrameworkId] ||
    defaultFrameworkLookup.default;

  const defaultFunctionsPath = ['netlify', 'functions'];
  const defaultFunctionsDirectory = path.join(...defaultFunctionsPath);

  const detectedFunctionsPathString =
    config.functionsDirectory || defaultFunctionsDirectory;
  const detectedFunctionsPath = detectedFunctionsPathString
    ? [path.sep, ...detectedFunctionsPathString.split(path.sep)]
    : defaultFunctionsPath;

  const baseConfig = {
    ...NetlifyGraph.defaultNetlifyGraphConfig,
    ...userSpecifiedConfig,
  };

  const defaultFrameworkConfig = makeDefaultFrameworkConfig({
    baseConfig,
    detectedFunctionsPath,
    siteRoot,
  });

  const tsConfig = 'tsconfig.json';
  const autodetectedLanguage = fs.existsSync(tsConfig)
    ? 'typescript'
    : 'javascript';

  const defaultConfig = {
    ...NetlifyGraph.defaultNetlifyGraphConfig,
    ...defaultFrameworkConfig,
    ...userSpecifiedConfig,
  };

  const userSpecifiedFunctionPath =
    userSpecifiedConfig.functionsPath &&
    userSpecifiedConfig.functionsPath.split(path.sep);

  const functionsPath =
    (userSpecifiedFunctionPath && [
      ...siteRoot,
      ...userSpecifiedFunctionPath,
    ]) ||
    defaultConfig.functionsPath;

  const netlifyGraphPath =
    (userSpecifiedConfig.netlifyGraphPath &&
      userSpecifiedConfig.netlifyGraphPath.split(path.sep)) ||
    defaultConfig.netlifyGraphPath ||
    functionsPath;

  const netlifyGraphImplementationFilename =
    (userSpecifiedConfig.netlifyGraphImplementationFilename &&
      userSpecifiedConfig.netlifyGraphImplementationFilename.split(path.sep)) ||
    defaultConfig.netlifyGraphImplementationFilename;
  const netlifyGraphTypeDefinitionsFilename =
    (userSpecifiedConfig.netlifyGraphTypeDefinitionsFilename &&
      userSpecifiedConfig.netlifyGraphTypeDefinitionsFilename.split(
        path.sep
      )) ||
    defaultConfig.netlifyGraphTypeDefinitionsFilename;
  const graphQLOperationsSourceFilename =
    (userSpecifiedConfig.graphQLOperationsSourceFilename &&
      userSpecifiedConfig.graphQLOperationsSourceFilename.split(path.sep)) ||
    defaultConfig.graphQLOperationsSourceFilename;
  const graphQLConfigJsonFilename =
    (userSpecifiedConfig.graphQLConfigJsonFilename &&
      userSpecifiedConfig.graphQLConfigJsonFilename.split(path.sep)) ||
    baseConfig.graphQLConfigJsonFilename ||
    defaultConfig.graphQLConfigJsonFilename;
  const graphQLSchemaFilename =
    (userSpecifiedConfig.graphQLSchemaFilename &&
      userSpecifiedConfig.graphQLSchemaFilename.split(path.sep)) ||
    defaultConfig.graphQLSchemaFilename;
  const netlifyGraphRequirePath =
    (userSpecifiedConfig.netlifyGraphRequirePath &&
      userSpecifiedConfig.netlifyGraphRequirePath.split(path.sep)) ||
    defaultConfig.netlifyGraphRequirePath;
  const moduleType =
    (userSpecifiedConfig.moduleType &&
      userSpecifiedConfig.moduleType.split(path.sep)) ||
    defaultConfig.moduleType;
  const language = userSpecifiedConfig.language || autodetectedLanguage;
  const webhookBasePath =
    (userSpecifiedConfig.webhookBasePath &&
      userSpecifiedConfig.webhookBasePath.split(path.sep)) ||
    defaultConfig.webhookBasePath;
  const customGeneratorFile =
    (userSpecifiedConfig.customGeneratorFile &&
      userSpecifiedConfig.customGeneratorFile.split(path.sep)) ||
    defaultConfig.customGeneratorFile;
  const userSpecifiedFrameworkId =
    userSpecifiedConfig.frameworkId || defaultConfig.frameworkId;
  const runtimeTargetEnv =
    userSpecifiedConfig.runtimeTargetEnv ||
    defaultConfig.runtimeTargetEnv ||
    'node';

  const fullConfig = {
    ...baseConfig,
    functionsPath,
    webhookBasePath,
    netlifyGraphPath,
    netlifyGraphImplementationFilename,
    netlifyGraphTypeDefinitionsFilename,
    graphQLOperationsSourceFilename,
    graphQLSchemaFilename,
    graphQLConfigJsonFilename,
    netlifyGraphRequirePath,
    framework: userSpecifiedFrameworkId || detectedFrameworkId || 'default',
    language,
    moduleType,
    customGeneratorFile,
    runtimeTargetEnv,
  };

  return fullConfig;
};

/**
 * Given a NetlifyGraphConfig, ensure that the netlifyGraphPath exists
 * @param {NetlifyGraph.NetlifyGraphConfig} netlifyGraphConfig
 */
const ensureNetlifyGraphPath = (netlifyGraphConfig) => {
  const fullPath = path.resolve(...netlifyGraphConfig.netlifyGraphPath);
  fs.mkdirSync(fullPath, { recursive: true });
};

const readGraphQLSchemaFile = (netlifyGraphConfig) => {
  ensureNetlifyGraphPath(netlifyGraphConfig);
  return fs.readFileSync(
    path.resolve(...netlifyGraphConfig.graphQLSchemaFilename),
    'utf8'
  );
};

/**
 * Using the given NetlifyGraphConfig, read the GraphQL operations file and return the _unparsed_ GraphQL operations doc
 * @param {NetlifyGraph.NetlifyGraphConfig} netlifyGraphConfig
 * @returns {string | null} GraphQL operations doc
 */
const readLegacyGraphQLOperationsSourceFile = (netlifyGraphConfig) => {
  ensureNetlifyGraphPath(netlifyGraphConfig)

  const fullFilename = path.resolve(...netlifyGraphConfig.graphQLOperationsSourceFilename)
  if (!fs.existsSync(fullFilename)) {
    return null
  }

  const source = fs.readFileSync(fullFilename, 'utf8')

  return source
}

/**
 * Using the given NetlifyGraphConfig, read all of the GraphQL operation files and return the _unparsed_ GraphQL operations doc
 * @param {NetlifyGraph.NetlifyGraphConfig} netlifyGraphConfig
 * @returns {string | null} GraphQL operations doc
 */
const readGraphQLOperationsSourceFiles = (netlifyGraphConfig) => {
  ensureNetlifyGraphPath(netlifyGraphConfig)

  const operationsPath = path.resolve(...netlifyGraphConfig.graphQLOperationsSourceDirectory)

  const operationFiles = []

  const filenames = fs.readdirSync(operationsPath)

  console.log("operationsPath", operationsPath)
  console.log("filenames", filenames)
  filenames.forEach((filename) => {
    if (/.*\.(graphql?)/gi.test(filename)) {
      const content = fs.readFileSync(path.resolve(operationsPath, filename), 'utf8')
      const file = {
        name: filename,
        path: path.resolve(operationsPath, filename),
        content,
        parsedOperation: parse(content),
      }

      operationFiles.push(file)
    }
  })

  const emptyDocDefinitionNode = {
    kind: Kind.DOCUMENT,
    definitions: [],
  }

  const parsedDoc = operationFiles.reduce((acc, file) => {
    const { parsedOperation } = file
    const { definitions } = parsedOperation
    return {
      kind: Kind.DOCUMENT,
      definitions: [...acc.definitions, ...definitions],
    }
  }, emptyDocDefinitionNode)

  const source = print(parsedDoc)

  console.log("GraphQL source", source)

  return source
}

const generatePersistedFunctionsFile = async ({
  fragments,
  functions,
  logger,
  netlifyGraphConfig,
  netlifyToken,
  operationsDoc,
  schema,
  schemaId,
  siteId,
}) => {
  const {
    clientSource,
    failedPersistedFunctions,
    functionDefinitions,
    typeDefinitionsSource,
  } = await NetlifyGraph.generatePersistedFunctionsSource(
    netlifyGraphConfig,
    netlifyToken,
    siteId,
    schema,
    operationsDoc,
    functions,
    fragments,
    schemaId
  );

  ensureNetlifyGraphPath(netlifyGraphConfig);
  const implementationResolvedPath = path.resolve(
    ...netlifyGraphConfig.netlifyGraphImplementationFilename
  );
  fs.writeFileSync(implementationResolvedPath, clientSource, 'utf8');
  const implementationRelativePath = path.relative(
    process.cwd(),
    implementationResolvedPath
  );
  logger && logger(`Wrote ${implementationRelativePath}`);

  const typeDefinitionsResolvedPath = path.resolve(
    ...netlifyGraphConfig.netlifyGraphTypeDefinitionsFilename
  );
  fs.writeFileSync(typeDefinitionsResolvedPath, typeDefinitionsSource, 'utf8');
  const typeDefinitionsRelativePath = path.relative(
    process.cwd(),
    typeDefinitionsResolvedPath
  );
  logger && logger(`Wrote ${typeDefinitionsRelativePath}`);

  logger &&
    logger(`${implementationRelativePath}:
${clientSource}`);

  logger &&
    logger(`${typeDefinitionsRelativePath}:
${typeDefinitionsSource}`);

  // runPrettier(
  //   path.resolve(...netlifyGraphConfig.netlifyGraphImplementationFilename)
  // );
  // runPrettier(
  //   path.resolve(...netlifyGraphConfig.netlifyGraphTypeDefinitionsFilename)
  // );

  return { failedPersistedFunctions, functionDefinitions };
};

// The plugin main logic uses `on...` event handlers that are triggered on
// each new Netlify Build.
// Anything can be done inside those event handlers.
// Information about the current build are passed as arguments. The build
// configuration file and some core utilities are also available.

export const onPreBuild = async function onPreBuild({
  constants,
  // Core utilities
  utils: {
    // Utility to report errors.
    // See https://github.com/netlify/build#error-reporting
    build,
    // Utility to display information in the deploy summary.
    // See https://github.com/netlify/build#logging
    status,
  },
}) {
  const netlifyToken = process.env.NETLIFY_GRAPH_PERSIST_QUERY_TOKEN;

  if (!netlifyToken) {
    console.warn(
      `Missing the NETLIFY_GRAPH_PERSIST_QUERY_TOKEN enviroment variable, skipping production Netlify Graph client generation.

Run \`netlify graph:init\` to generate a new token.`
    );

    status.show({
      title:
        'Netlify Graph Build Plugin: Missing NETLIFY_GRAPH_PERSIST_QUERY_TOKEN',
      summary: `Skipped production Netlify Graph client generation due to missing token

      Run \`netlify graph:init\` to generate a new token`,
    });
    return;
  }

  try {
    const path = constants.CONFIG_PATH;
    const resolvedConfig = await resolveConfig({
      configPath: path,
    });
    const { config, siteInfo } = resolvedConfig;

    const netlifyGraphConfig = await getNetlifyGraphConfig({
      config,
      options: {},
      site: siteInfo,
    });

    let netlifyGraphJson;
    try {
      netlifyGraphJson = JSON.parse(
        fs.readFileSync('netlifyGraph.json', 'utf8')
      );
    } catch (error) {
      build.failBuild(
        'Error reading netlifyGraph.json. Be sure to run `netlify graph:init` and commit the resulting json file.',
        {
          error,
        }
      );
    }

    console.log('Creating a new Netlify Graph schema');

    const createGraphQLSchemaResult =
      await OneGraphClient.executeCreateGraphQLSchemaMutation(
        {
          input: {
            appId: constants.SITE_ID,
            enabledServices: netlifyGraphJson.enabledServices,
            setAsDefaultForApp: false,
            externalGraphQLSchemas: [],
            parentId: undefined,
            salesforceSchemaId: undefined,
          },
        },
        {
          siteId: constants.SITE_ID,
          accessToken: netlifyToken,
        }
      );

    console.log(
      'Created a new Netlify Graph schema',
      createGraphQLSchemaResult
    );

    const newSchemaId =
      createGraphQLSchemaResult.data.oneGraph.createGraphQLSchema.graphQLSchema
        .id;

    let schema;

    const schemaString = readGraphQLSchemaFile(netlifyGraphConfig);

    try {
      schema = GraphQL.buildSchema(schemaString);
    } catch (buildSchemaError) {
      console.error(`Error parsing schema: ${buildSchemaError}`);
    }

    if (!schema) {
      console.error(`Failed to parse Netlify GraphQL schema`);
      return;
    }

    const legacySourceGraphQLFile = readLegacyGraphQLOperationsSourceFile(netlifyGraphConfig)

    if (legacySourceGraphQLFile) {
      build.failBuild('Found legacy single-file operations library. Run `netlify graph:library` to migrate');
    }

    let currentOperationsDoc =
      readGraphQLOperationsSourceFiles(netlifyGraphConfig);
    if (currentOperationsDoc.trim().length === 0) {
      console.warn(
        'No Graph operations library found, skipping production client generation.'
      );
      return;
    }

    const parsedDoc = GraphQL.parse(currentOperationsDoc);
    const { fragments, functions } =
      NetlifyGraph.extractFunctionsFromOperationDoc(parsedDoc);

    const { failedPersistedFunctions, functionDefinitions } =
      await generatePersistedFunctionsFile({
        logger: console.log,
        netlifyGraphConfig,
        schema,
        operationsDoc: currentOperationsDoc,
        functions,
        fragments,
        siteId: constants.SITE_ID,
        netlifyToken,
        schemaId: newSchemaId,
      });

    if (failedPersistedFunctions.length > 0) {
      const failedFunctionNames = failedPersistedFunctions.map(
        (failedFunction) => failedFunction.attemptedFunction.operationName
      );

      status.show({
        title: `Netlify Graph Build Plugin: Failed to persist ${failedFunctionNames.length} Graph functions`,
        summary: `See the log for details`,
      });

      build.failBuild(
        `Error persisting Netlify Graph operations for production: [${failedFunctionNames.join(
          ', '
        )}]`,
        {
          failedPersistedFunctions: failedPersistedFunctions,
        }
      );
    } else {
      status.show({
        title: `Netlify Graph Build Plugin: Successfully persisted ${functionDefinitions.length} Graph functions`,
        summary: `See the log for details`,
      });
    }
  } catch (error) {
    // Report a user error
    build.failBuild('Error generating a production Netlify Graph client', {
      error,
    });
  }
};

const test = async () => {
  console.log(await listFrameworks());
};

test();
