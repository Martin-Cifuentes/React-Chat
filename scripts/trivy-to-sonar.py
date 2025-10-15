#!/usr/bin/env python3
"""
Conversor de reportes Trivy a formato Generic Issue Import de SonarQube

Este script convierte vulnerabilidades detectadas por Trivy (en formato JSON)
al formato Generic Issue que SonarQube puede importar via sonar.externalIssuesReportPaths.

Uso:
    python3 trivy-to-sonar.py --image-report trivy-image.json --fs-report trivy-fs.json --output sonar-trivy.json

Formato de salida (SonarQube Generic Issue Import Format):
    {
      "issues": [
        {
          "engineId": "trivy",
          "ruleId": "CVE-2024-XXXX",
          "severity": "CRITICAL",
          "type": "VULNERABILITY",
          "primaryLocation": {
            "message": "Vulnerability description",
            "filePath": "path/to/file",
            "textRange": {
              "startLine": 1
            }
          }
        }
      ]
    }

Mapeo de severidades:
    CRITICAL → CRITICAL
    HIGH     → CRITICAL
    MEDIUM   → MAJOR
    LOW      → MINOR
    UNKNOWN  → INFO
"""

import json
import argparse
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional


# Mapeo de severidades Trivy → SonarQube
SEVERITY_MAPPING = {
    "CRITICAL": "CRITICAL",
    "HIGH": "CRITICAL",
    "MEDIUM": "MAJOR",
    "LOW": "MINOR",
    "UNKNOWN": "INFO"
}


def parse_arguments():
    """Parsear argumentos de línea de comandos"""
    parser = argparse.ArgumentParser(
        description="Convierte reportes Trivy a formato SonarQube Generic Issue"
    )
    parser.add_argument(
        "--image-report",
        type=str,
        help="Path al reporte JSON de Trivy para imagen Docker"
    )
    parser.add_argument(
        "--fs-report",
        type=str,
        help="Path al reporte JSON de Trivy para filesystem"
    )
    parser.add_argument(
        "--output",
        type=str,
        required=True,
        help="Path del archivo de salida (formato SonarQube)"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Habilitar modo verbose"
    )
    return parser.parse_args()


def load_trivy_report(file_path: str) -> Optional[Dict[str, Any]]:
    """Cargar y validar un reporte Trivy JSON"""
    try:
        if not Path(file_path).exists():
            print(f"⚠️  Archivo no encontrado: {file_path}", file=sys.stderr)
            return None
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if not data:
            print(f"⚠️  Archivo vacío: {file_path}", file=sys.stderr)
            return None
        
        return data
    except json.JSONDecodeError as e:
        print(f"❌ Error al parsear JSON {file_path}: {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"❌ Error al leer {file_path}: {e}", file=sys.stderr)
        return None


def get_file_path_for_vulnerability(vuln: Dict[str, Any], target: str) -> str:
    """
    Determinar el path del archivo para una vulnerabilidad.
    
    Las vulnerabilidades de dependencias no tienen un archivo fuente específico,
    por lo que creamos un path virtual basado en el target/package.
    """
    # Intentar obtener path desde diferentes fuentes
    pkg_name = vuln.get("PkgName", "unknown")
    
    # Para dependencias npm/node, usar package.json
    if "node_modules" in target.lower() or "package" in target.lower():
        if "client" in target.lower():
            return "client/package.json"
        elif "server" in target.lower():
            return "server/package.json"
        return "package.json"
    
    # Para imágenes Docker
    if "Dockerfile" in target or "(alpine" in target.lower() or "image" in target.lower():
        return "Dockerfile"
    
    # Fallback: crear path virtual
    return f"dependencies/{pkg_name}/SECURITY.md"


def convert_vulnerability_to_issue(
    vuln: Dict[str, Any],
    target: str,
    source: str = "trivy"
) -> Dict[str, Any]:
    """
    Convertir una vulnerabilidad de Trivy a formato SonarQube Issue
    
    Args:
        vuln: Diccionario con la vulnerabilidad de Trivy
        target: Target del escaneo (ej: "node_modules", "alpine:3.19")
        source: Fuente del escaneo ("image" o "filesystem")
    
    Returns:
        Diccionario con el formato de issue de SonarQube
    """
    vuln_id = vuln.get("VulnerabilityID", "UNKNOWN")
    pkg_name = vuln.get("PkgName", "unknown")
    installed_version = vuln.get("InstalledVersion", "unknown")
    fixed_version = vuln.get("FixedVersion", "")
    severity = vuln.get("Severity", "UNKNOWN")
    title = vuln.get("Title", "")
    description = vuln.get("Description", "")
    references = vuln.get("References", [])
    
    # Construir mensaje descriptivo
    message_parts = [f"{vuln_id}: {title or description[:100]}"]
    message_parts.append(f"Package: {pkg_name} (installed: {installed_version})")
    
    if fixed_version:
        message_parts.append(f"Fixed in version: {fixed_version}")
    else:
        message_parts.append("No fix available yet")
    
    if references and len(references) > 0:
        message_parts.append(f"Reference: {references[0]}")
    
    message = " | ".join(message_parts)
    
    # Determinar archivo
    file_path = get_file_path_for_vulnerability(vuln, target)
    
    # Crear issue en formato SonarQube
    issue = {
        "engineId": "trivy",
        "ruleId": vuln_id,
        "severity": SEVERITY_MAPPING.get(severity, "INFO"),
        "type": "VULNERABILITY",
        "primaryLocation": {
            "message": message,
            "filePath": file_path,
            "textRange": {
                "startLine": 1
            }
        }
    }
    
    # Agregar información secundaria si está disponible
    if description and description != title:
        issue["secondaryLocations"] = [{
            "message": description[:500],  # Limitar longitud
            "filePath": file_path,
            "textRange": {
                "startLine": 1
            }
        }]
    
    return issue


def process_trivy_report(
    report: Dict[str, Any],
    source: str,
    verbose: bool = False
) -> List[Dict[str, Any]]:
    """
    Procesar un reporte Trivy completo y extraer todas las vulnerabilidades
    
    Args:
        report: Reporte Trivy completo (formato JSON)
        source: "image" o "filesystem"
        verbose: Imprimir información detallada
    
    Returns:
        Lista de issues en formato SonarQube
    """
    issues = []
    
    results = report.get("Results", [])
    
    for result in results:
        target = result.get("Target", "unknown")
        vulnerabilities = result.get("Vulnerabilities", [])
        
        if verbose:
            print(f"📦 Procesando target: {target} ({len(vulnerabilities)} vulnerabilidades)")
        
        for vuln in vulnerabilities:
            try:
                issue = convert_vulnerability_to_issue(vuln, target, source)
                issues.append(issue)
            except Exception as e:
                print(f"⚠️  Error procesando vulnerabilidad {vuln.get('VulnerabilityID')}: {e}", 
                      file=sys.stderr)
                continue
    
    return issues


def main():
    """Función principal"""
    args = parse_arguments()
    
    all_issues = []
    
    # Procesar reporte de imagen Docker
    if args.image_report:
        print(f"🔍 Procesando reporte de imagen: {args.image_report}")
        image_report = load_trivy_report(args.image_report)
        if image_report:
            image_issues = process_trivy_report(image_report, "image", args.verbose)
            all_issues.extend(image_issues)
            print(f"✅ {len(image_issues)} vulnerabilidades encontradas en imagen")
    
    # Procesar reporte de filesystem
    if args.fs_report:
        print(f"🔍 Procesando reporte de filesystem: {args.fs_report}")
        fs_report = load_trivy_report(args.fs_report)
        if fs_report:
            fs_issues = process_trivy_report(fs_report, "filesystem", args.verbose)
            all_issues.extend(fs_issues)
            print(f"✅ {len(fs_issues)} vulnerabilidades encontradas en filesystem")
    
    # Validar que haya issues
    if not all_issues:
        print("⚠️  No se encontraron vulnerabilidades. Generando reporte vacío.")
    
    # Crear estructura de salida
    output = {
        "issues": all_issues
    }
    
    # Guardar archivo de salida
    try:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        
        print(f"\n✅ Reporte generado exitosamente: {args.output}")
        print(f"📊 Total de issues: {len(all_issues)}")
        
        # Estadísticas por severidad
        severity_counts = {}
        for issue in all_issues:
            severity = issue["severity"]
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        print("\n📈 Distribución por severidad:")
        for severity in ["CRITICAL", "MAJOR", "MINOR", "INFO"]:
            count = severity_counts.get(severity, 0)
            if count > 0:
                print(f"   {severity}: {count}")
        
        return 0
    
    except Exception as e:
        print(f"❌ Error al guardar archivo: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())