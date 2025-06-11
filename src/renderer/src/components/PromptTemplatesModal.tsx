import React, { useState, useMemo } from 'react';
import './PromptTemplatesModal.scss';
import { 
  RiCloseLine,
  RiCurrencyLine,
  RiServerLine,
  RiShieldLine,
  RiWifiLine,
  RiDatabase2Line,
  RiCodeSSlashLine
} from 'react-icons/ri';
import { 
  FaEthereum,
  FaBitcoin,
  FaDocker
} from 'react-icons/fa';
import { 
  SiKubernetes,
  SiNginx,
  SiPostgresql,
  SiRedis,
  SiMongodb
} from 'react-icons/si';

interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: React.ReactNode;
  category: 'blockchain' | 'infrastructure' | 'database' | 'security' | 'layer2' | 'defi';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
}

interface PromptTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (prompt: string) => void;
}

interface FilterState {
  category: string;
  difficulty: string;
  searchTerm: string;
}

const promptTemplates: PromptTemplate[] = [
  {
    id: 'ethereum-node',
    title: 'Ethereum Full Node',
    description: 'Deploy complete Ethereum mainnet node with Geth',
    prompt: 'Set up a full Ethereum mainnet node using Geth. Configure fast sync, set up proper data directories with SSD optimization, enable JSON-RPC API, configure automatic startup with systemd, and set up log rotation. Include firewall configuration and monitoring setup.',
    icon: <FaEthereum />,
    category: 'blockchain',
    difficulty: 'intermediate',
    estimatedTime: '30-45 min'
  },
  {
    id: 'ethereum-wallet',
    title: 'Secure Wallet Creation',
    description: 'Generate and secure Ethereum wallet with backup',
    prompt: 'Create a new Ethereum wallet using Geth with maximum security. Generate wallet with strong password, export private key and keystore file, store them in encrypted format with proper file permissions (600), create secure backup strategy, and provide wallet address with recovery instructions.',
    icon: <RiCurrencyLine />,
    category: 'blockchain',
    difficulty: 'beginner',
    estimatedTime: '10-15 min'
  },
  {
    id: 'ethereum-validator',
    title: 'ETH2 Validator Node',
    description: 'Complete Ethereum 2.0 staking validator setup',
    prompt: 'Set up a professional Ethereum 2.0 validator node with Prysm. Install and configure beacon chain node, validator client, generate validator keys securely, set up slashing protection, configure monitoring with metrics, and implement automated backup of validator keys.',
    icon: <RiShieldLine />,
    category: 'blockchain',
    difficulty: 'advanced',
    estimatedTime: '60-90 min'
  },
  {
    id: 'bitcoin-node',
    title: 'Bitcoin Full Node',
    description: 'Deploy Bitcoin Core with full blockchain sync',
    prompt: 'Install and configure Bitcoin Core full node. Set up complete blockchain download and sync, configure RPC access with authentication, set up automatic startup, implement proper backup strategy for wallet.dat, and configure monitoring for node health.',
    icon: <FaBitcoin />,
    category: 'blockchain',
    difficulty: 'intermediate',
    estimatedTime: '45-60 min'
  },
  {
    id: 'docker-blockchain',
    title: 'Docker for Blockchain',
    description: 'Docker setup optimized for blockchain applications',
    prompt: 'Install Docker and Docker Compose optimized for blockchain workloads. Configure Docker with increased memory limits, set up volumes for blockchain data persistence, add current user to docker group, configure automatic startup, and create sample docker-compose for Ethereum node.',
    icon: <FaDocker />,
    category: 'infrastructure',
    difficulty: 'beginner',
    estimatedTime: '15-20 min'
  },
  {
    id: 'solana-validator',
    title: 'Solana Validator',
    description: 'High-performance Solana validator node setup',
    prompt: 'Set up a Solana validator node with optimal performance configuration. Install Solana CLI tools, configure validator identity, set up vote account, implement proper key management, configure monitoring, and set up automated updates with safeguards.',
    icon: <RiServerLine />,
    category: 'blockchain',
    difficulty: 'advanced',
    estimatedTime: '90-120 min'
  },
  {
    id: 'defi-node',
    title: 'DeFi Archive Node',
    description: 'Ethereum archive node for DeFi applications',
    prompt: 'Deploy an Ethereum archive node optimized for DeFi applications. Configure Geth with archive mode, set up fast NVMe storage, enable GraphQL and WebSocket APIs, configure CORS for DApp access, and implement caching strategies for better performance.',
    icon: <RiDatabase2Line />,
    category: 'blockchain',
    difficulty: 'advanced',
    estimatedTime: '45-75 min'
  },
  {
    id: 'polygon-node',
    title: 'Polygon Validator',
    description: 'Polygon (MATIC) validator node deployment',
    prompt: 'Set up a Polygon validator node with Heimdall and Bor. Configure both services, sync with mainnet, set up validator keys, implement staking setup, configure monitoring and alerting, and set up automated backup procedures.',
    icon: <RiCurrencyLine />,
    category: 'blockchain',
    difficulty: 'advanced',
    estimatedTime: '75-90 min'
  },
  {
    id: 'ipfs-node',
    title: 'IPFS Storage Node',
    description: 'Decentralized storage with IPFS for Web3',
    prompt: 'Install and configure IPFS node for decentralized storage. Set up IPFS daemon with custom configuration, configure storage limits, enable gateway access, set up pinning services, and implement backup strategies for pinned content.',
    icon: <RiDatabase2Line />,
    category: 'blockchain',
    difficulty: 'intermediate',
    estimatedTime: '25-35 min'
  },
  {
    id: 'hardhat-env',
    title: 'Smart Contract Dev Environment',
    description: 'Complete Hardhat development setup for smart contracts',
    prompt: 'Set up a complete smart contract development environment with Hardhat. Install Node.js, configure Hardhat with TypeScript, set up local blockchain network, configure testing environment, install essential plugins, and create sample smart contract structure.',
    icon: <RiCodeSSlashLine />,
    category: 'blockchain',
    difficulty: 'intermediate',
    estimatedTime: '20-30 min'
  },
  {
    id: 'blockchain-monitoring',
    title: 'Blockchain Monitoring',
    description: 'Comprehensive monitoring for blockchain nodes',
    prompt: 'Set up comprehensive monitoring for blockchain nodes using Prometheus and Grafana. Configure node exporters, blockchain-specific metrics, set up alerting for node issues, create dashboards for network stats, and implement log aggregation.',
    icon: <RiDatabase2Line />,
    category: 'infrastructure',
    difficulty: 'advanced',
    estimatedTime: '45-60 min'
  },
  {
    id: 'blockchain-security',
    title: 'Blockchain Security Hardening',
    description: 'Security best practices for blockchain infrastructure',
    prompt: 'Implement comprehensive security hardening for blockchain servers. Configure advanced firewall rules, set up fail2ban for blockchain ports, implement SSH key-only access, configure automated security updates, set up intrusion detection, and create backup encryption.',
    icon: <RiShieldLine />,
    category: 'security',
    difficulty: 'intermediate',
    estimatedTime: '40-60 min'
  },
  {
    id: 'wallet-backup-system',
    title: 'Automated Wallet Backup',
    description: 'Secure automated backup system for crypto wallets',
    prompt: 'Create a comprehensive automated backup system for cryptocurrency wallets. Set up encrypted backup of wallet files, private keys, and seed phrases with password protection. Configure automated daily backups to multiple cloud providers (AWS S3, Google Cloud, IPFS), implement 3-2-1 backup strategy, create recovery scripts with password verification, and set up backup integrity checking.',
    icon: <RiDatabase2Line />,
    category: 'security',
    difficulty: 'advanced',
    estimatedTime: '60-90 min'
  },
  {
    id: 'cloud-wallet-vault',
    title: 'Cloud Wallet Vault',
    description: 'Multi-cloud encrypted vault for wallet storage',
    prompt: 'Deploy a secure multi-cloud wallet vault system. Set up encrypted storage across AWS S3, Google Cloud Storage, and Azure Blob with AES-256 encryption. Configure automatic key rotation, implement multi-factor authentication for access, create secure API for wallet retrieval, set up geographic distribution of backups, and implement access logging and monitoring.',
    icon: <RiShieldLine />,
    category: 'security',
    difficulty: 'advanced',
    estimatedTime: '90-120 min'
  },
  {
    id: 'wallet-recovery-system',
    title: 'Wallet Recovery Assistant',
    description: 'Automated wallet recovery with secure verification',
    prompt: 'Build an automated wallet recovery system with multiple security layers. Create secure password-based recovery process, implement seed phrase verification, set up multi-factor authentication, configure secure key derivation (PBKDF2/Argon2), create recovery audit logs, implement rate limiting for recovery attempts, and set up encrypted communication channels.',
    icon: <RiCurrencyLine />,
    category: 'security',
    difficulty: 'intermediate',
    estimatedTime: '45-75 min'
  },
  {
    id: 'metamask-backup-automation',
    title: 'MetaMask Backup Automation',
    description: 'Automated MetaMask wallet backup and sync',
    prompt: 'Set up automated MetaMask wallet backup system. Create scripts to securely backup MetaMask vault files, encrypt seed phrases and private keys, configure automatic sync to cloud storage with versioning, implement cross-device restoration, set up backup verification, and create secure sharing mechanisms for team wallets.',
    icon: <FaEthereum />,
    category: 'blockchain',
    difficulty: 'intermediate',
    estimatedTime: '30-45 min'
  },
  {
    id: 'hardware-wallet-backup',
    title: 'Hardware Wallet Backup',
    description: 'Secure backup for Ledger/Trezor configurations',
    prompt: 'Create comprehensive backup system for hardware wallets (Ledger/Trezor). Set up secure backup of device configurations, account derivations, custom tokens, and application settings. Configure encrypted cloud storage with multiple recovery methods, implement seed phrase secure storage with Shamir Secret Sharing, and create restoration procedures with verification.',
    icon: <RiShieldLine />,
    category: 'security',
    difficulty: 'advanced',
    estimatedTime: '75-90 min'
  },
  {
    id: 'defi-portfolio-backup',
    title: 'DeFi Portfolio Backup',
    description: 'Complete DeFi positions and wallet backup system',
    prompt: 'Build comprehensive DeFi portfolio backup system. Create automated backup of all wallet addresses, DeFi positions, LP tokens, staking rewards, transaction history, and smart contract interactions. Set up encrypted cloud storage with portfolio reconstruction capabilities, implement multi-wallet tracking, and create recovery documentation with step-by-step restoration guides.',
    icon: <RiDatabase2Line />,
    category: 'defi',
    difficulty: 'advanced',
    estimatedTime: '60-90 min'
  },
  {
    id: 'avalanche-node',
    title: 'Avalanche Node',
    description: 'Deploy high-performance Avalanche C-Chain node',
    prompt: 'Set up a complete Avalanche node with C-Chain, P-Chain, and X-Chain support. Configure AvalancheGo client, set up staking, configure API endpoints, implement monitoring and alerting, set up automatic updates, and configure backup strategies for validator keys.',
    icon: <RiServerLine />,
    category: 'blockchain',
    difficulty: 'intermediate',
    estimatedTime: '45-60 min'
  },
  {
    id: 'binance-smart-chain',
    title: 'BSC Validator Node',
    description: 'Binance Smart Chain validator deployment',
    prompt: 'Deploy a Binance Smart Chain validator node with Geth BSC. Configure fast sync, set up validator keys, implement staking mechanisms, configure monitoring for block production, set up backup and failover systems, and implement automated security updates.',
    icon: <RiCurrencyLine />,
    category: 'blockchain',
    difficulty: 'advanced',
    estimatedTime: '60-75 min'
  },
  {
    id: 'arbitrum-node',
    title: 'Arbitrum One Node',
    description: 'Layer 2 Arbitrum scaling solution node',
    prompt: 'Set up Arbitrum One node for Layer 2 scaling. Configure Nitro client, set up L1 Ethereum connection, configure sequencer communication, implement monitoring for L2 transactions, set up bridge monitoring, and configure automated backup systems.',
    icon: <RiServerLine />,
    category: 'layer2',
    difficulty: 'intermediate',
    estimatedTime: '40-55 min'
  },
  {
    id: 'optimism-node',
    title: 'Optimism Node',
    description: 'Layer 2 Optimism rollup node deployment',
    prompt: 'Deploy Optimism Layer 2 node with op-geth and op-node. Configure L1 connection to Ethereum mainnet, set up optimistic rollup verification, implement fraud proof monitoring, configure transaction sequencing, and set up comprehensive logging and monitoring.',
    icon: <RiDatabase2Line />,
    category: 'layer2',
    difficulty: 'intermediate',
    estimatedTime: '50-65 min'
  },
  {
    id: 'fantom-node',
    title: 'Fantom Opera Node',
    description: 'High-performance Fantom Opera chain node',
    prompt: 'Set up Fantom Opera mainnet node with go-opera client. Configure fast sync with Lachesis consensus, set up validator staking, implement monitoring for network performance, configure automatic updates, and set up backup strategies for validator keys.',
    icon: <RiCurrencyLine />,
    category: 'blockchain',
    difficulty: 'intermediate',
    estimatedTime: '35-50 min'
  },
  {
    id: 'cardano-node',
    title: 'Cardano Stake Pool',
    description: 'Cardano stake pool operator setup',
    prompt: 'Deploy a complete Cardano stake pool with cardano-node. Set up block producer and relay nodes, configure stake pool registration, implement monitoring with prometheus, set up automated backup of pool keys, configure topology updater, and implement security best practices.',
    icon: <RiShieldLine />,
    category: 'blockchain',
    difficulty: 'advanced',
    estimatedTime: '90-120 min'
  },
  {
    id: 'cosmos-validator',
    title: 'Cosmos Hub Validator',
    description: 'Cosmos Hub validator with IBC support',
    prompt: 'Set up Cosmos Hub validator with Gaia client. Configure tendermint consensus, set up validator signing, implement IBC relayer setup, configure monitoring and alerting, set up key management with HSM support, and implement automated backup and recovery procedures.',
    icon: <RiServerLine />,
    category: 'blockchain',
    difficulty: 'advanced',
    estimatedTime: '75-100 min'
  },
  {
    id: 'near-validator',
    title: 'NEAR Protocol Validator',
    description: 'NEAR Protocol validator node with sharding',
    prompt: 'Deploy NEAR Protocol validator node with nearcore. Configure sharding support, set up validator staking, implement chunk production monitoring, configure automatic updates with rollback capability, set up key rotation procedures, and implement comprehensive monitoring.',
    icon: <RiDatabase2Line />,
    category: 'blockchain',
    difficulty: 'advanced',
    estimatedTime: '70-90 min'
  },
  {
    id: 'uniswap-v3-deployment',
    title: 'Uniswap V3 Deployment',
    description: 'Deploy Uniswap V3 protocol on private chain',
    prompt: 'Deploy complete Uniswap V3 protocol infrastructure. Set up core contracts, configure factory and router, implement liquidity pool creation, set up price oracle integration, configure fee collection mechanisms, and create admin interfaces for protocol management.',
    icon: <RiCurrencyLine />,
    category: 'defi',
    difficulty: 'advanced',
    estimatedTime: '120-150 min'
  },
  {
    id: 'compound-protocol',
    title: 'Compound DeFi Protocol',
    description: 'Lending protocol deployment with governance',
    prompt: 'Deploy Compound lending protocol with full governance system. Set up cToken contracts, configure interest rate models, implement liquidation mechanisms, set up COMP token distribution, configure governance voting, and implement risk management systems.',
    icon: <RiDatabase2Line />,
    category: 'defi',
    difficulty: 'advanced',
    estimatedTime: '150-180 min'
  },
  {
    id: 'chainlink-node',
    title: 'Chainlink Oracle Node',
    description: 'Decentralized oracle network node setup',
    prompt: 'Set up Chainlink oracle node with external adapters. Configure job specifications, implement price feed aggregation, set up external API connections, configure monitoring and alerting, implement automatic failover, and set up LINK token management.',
    icon: <RiServerLine />,
    category: 'defi',
    difficulty: 'intermediate',
    estimatedTime: '60-80 min'
  }
];

const PromptTemplatesModal: React.FC<PromptTemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate
}) => {
  const [filters, setFilters] = useState<FilterState>({
    category: 'all',
    difficulty: 'all',
    searchTerm: ''
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'blockchain': return '#a855f7';
      case 'layer2': return '#06b6d4';
      case 'defi': return '#f59e0b';
      case 'infrastructure': return '#3b82f6';
      case 'database': return '#10b981';
      case 'security': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '#10b981';
      case 'intermediate': return '#f59e0b';
      case 'advanced': return '#ef4444';
      default: return '#6b7280';
    }
  };

  // Filter templates based on current filters
  const filteredTemplates = useMemo(() => {
    return promptTemplates.filter(template => {
      const matchesCategory = filters.category === 'all' || template.category === filters.category;
      const matchesDifficulty = filters.difficulty === 'all' || template.difficulty === filters.difficulty;
      const matchesSearch = filters.searchTerm === '' || 
        template.title.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(filters.searchTerm.toLowerCase());
      
      return matchesCategory && matchesDifficulty && matchesSearch;
    });
  }, [filters]);

  const handleTemplateClick = (template: PromptTemplate) => {
    onSelectTemplate(template.prompt);
    onClose();
  };

  const handleFilterChange = (filterType: keyof FilterState, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const resetFilters = () => {
    setFilters({
      category: 'all',
      difficulty: 'all',
      searchTerm: ''
    });
  };

  if (!isOpen) return null;

  return (
    <div className="prompt-templates-overlay" onClick={onClose}>
      <div className="prompt-templates-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-content">
            <h2>Quick Start Templates</h2>
            <p>Choose from pre-built prompts for common server setups and blockchain deployments</p>
          </div>
          <button className="close-button" onClick={onClose}>
            <RiCloseLine />
          </button>
        </div>

        <div className="modal-content">
          {/* Filters Section */}
          <div className="filters-section">
            <div className="filters-row">
              <div className="filter-group">
                <label>Category</label>
                <select 
                  value={filters.category} 
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                >
                  <option value="all">All Categories</option>
                  <option value="blockchain">Blockchain Nodes</option>
                  <option value="layer2">Layer 2 Solutions</option>
                  <option value="defi">DeFi Protocols</option>
                  <option value="security">Security & Backup</option>
                  <option value="infrastructure">Infrastructure</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Difficulty</label>
                <select 
                  value={filters.difficulty} 
                  onChange={(e) => handleFilterChange('difficulty', e.target.value)}
                >
                  <option value="all">All Levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div className="filter-group search-group">
                <label>Search Templates</label>
                <input
                  type="text"
                  placeholder="Search by name or description..."
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                />
              </div>

              <button className="reset-filters-btn" onClick={resetFilters}>
                Reset Filters
              </button>
            </div>

            <div className="filter-stats">
              <span>{filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} found</span>
            </div>
          </div>

          <div className="templates-grid">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className={`template-card ${template.category} ${template.difficulty}`}
                onClick={() => handleTemplateClick(template)}
              >
                <div className="card-header">
                  <div 
                    className="template-icon"
                    style={{ color: getCategoryColor(template.category) }}
                  >
                    {template.icon}
                  </div>
                  <div className="template-badges">
                    <span 
                      className="category-badge"
                      style={{ backgroundColor: getCategoryColor(template.category) }}
                    >
                      {template.category}
                    </span>
                    <span 
                      className="difficulty-badge"
                      style={{ backgroundColor: getDifficultyColor(template.difficulty) }}
                    >
                      {template.difficulty}
                    </span>
                  </div>
                </div>

                <div className="card-content">
                  <h3 className="template-title">{template.title}</h3>
                  <p className="template-description">{template.description}</p>
                  
                  <div className="template-meta">
                    <span className="estimated-time">
                      <RiWifiLine />
                      {template.estimatedTime}
                    </span>
                  </div>
                </div>

                <div className="card-hover-content">
                  <p className="prompt-preview">
                    "{template.prompt.length > 100 
                      ? `${template.prompt.substring(0, 100)}...` 
                      : template.prompt}"
                  </p>
                  <div className="hover-action">
                    <span>Click to use this template</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <div className="footer-info">
            <p>🚀 Comprehensive templates for blockchain nodes, Layer 2 solutions, DeFi protocols, and security infrastructure - all deployable with AI assistance</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptTemplatesModal; 